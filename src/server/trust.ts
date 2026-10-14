import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  adjustmentForTarget,
  calculateTrust,
  trustRuleSchema,
  type TrustInputs,
} from "./trust-calculation";
import { claimMutation, finishMutation } from "./idempotency";
export type TrustDatabase = Pick<
  Prisma.TransactionClient,
  | "trustPolicyState"
  | "trustRuleVersion"
  | "trustEvent"
  | "userTrustReview"
  | "userTrustState"
  | "trustSnapshot"
>;
export async function readActiveRule(database: TrustDatabase) {
  const policy = await database.trustPolicyState.findUnique({
    where: { singletonId: "global" },
  });
  if (!policy?.activeRuleId) throw new Error("TRUST_UNCONFIGURED");
  const rule = await database.trustRuleVersion.findUniqueOrThrow({
    where: { id: policy.activeRuleId },
  });
  if (rule.status !== "ACTIVE") throw new Error("TRUST_UNCONFIGURED");
  trustRuleSchema.parse(rule);
  return { policy, rule };
}
export async function trustInputs(
  database: TrustDatabase,
  userId: string,
): Promise<TrustInputs> {
  const [adjustment, accepted, rejected, reviews] = await Promise.all([
    database.trustEvent.aggregate({
      where: { userId, type: "ADJUSTMENT" },
      _sum: { value: true },
    }),
    database.trustEvent.count({
      where: { userId, type: "ACCEPTED", actorId: { not: userId } },
    }),
    database.trustEvent.count({
      where: { userId, type: "REJECTED", actorId: { not: userId } },
    }),
    database.userTrustReview.aggregate({
      where: { targetId: userId, reviewerId: { not: userId } },
      _sum: { value: true },
    }),
  ]);
  return {
    adjustment: adjustment._sum.value ?? 0,
    accepted,
    rejected,
    reviews: reviews._sum.value ?? 0,
  };
}
export async function incrementTrustInput(
  database: TrustDatabase,
  userId: string,
) {
  return database.userTrustState.upsert({
    where: { userId },
    create: { userId, inputVersion: 1 },
    update: { inputVersion: { increment: 1 } },
  });
}
export async function readTrust(database: TrustDatabase, userId: string) {
  const { rule } = await readActiveRule(database);
  const state = await database.userTrustState.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
  const cached = await database.trustSnapshot.findUnique({ where: { userId } });
  const inputs = await trustInputs(database, userId);
  const score =
    cached?.ruleId === rule.id && cached.inputVersion === state.inputVersion
      ? cached.score
      : calculateTrust(rule, inputs);
  if (
    !cached ||
    cached.ruleId !== rule.id ||
    cached.inputVersion !== state.inputVersion
  ) {
    await database.trustSnapshot.upsert({
      where: { userId },
      create: {
        userId,
        ruleId: rule.id,
        inputVersion: state.inputVersion,
        score,
      },
      update: {
        ruleId: rule.id,
        inputVersion: state.inputVersion,
        score,
        calculatedAt: new Date(),
      },
    });
  }
  return {
    userId,
    ruleId: rule.id,
    ruleVersion: rule.version,
    inputVersion: state.inputVersion,
    score,
    threshold: rule.mergeThreshold,
    inputs,
  };
}
export async function publishTrustRule(
  database: PrismaClient,
  input: {
    actorId: string;
    rule: unknown;
    expectedPolicyVersion: number;
    reason: string;
    key: string;
  },
) {
  const numbers = trustRuleSchema.parse(input.rule);
  if (!input.reason.trim()) throw new Error("REASON_REQUIRED");
  return database.$transaction(
    async (transaction) => {
      const actor = await transaction.user.findUniqueOrThrow({
        where: { id: input.actorId },
      });
      if (actor.serviceRole !== "OPERATOR") throw new Error("FORBIDDEN");
      const receipt = await claimMutation(transaction, {
        actorId: actor.id,
        operation: "PUBLISH_TRUST_RULE",
        key: input.key,
        payload: {
          rule: numbers,
          reason: input.reason,
          expectedPolicyVersion: input.expectedPolicyVersion,
        },
      });
      if (receipt.status === "COMPLETED") return receipt.result;
      const policy = await transaction.trustPolicyState.upsert({
        where: { singletonId: "global" },
        create: { singletonId: "global" },
        update: {},
      });
      if (policy.version !== input.expectedPolicyVersion)
        throw new Error("CONFLICT");
      const rule = await transaction.trustRuleVersion.create({
        data: {
          ...numbers,
          version: policy.version + 1,
          status: "ACTIVE",
          operatorId: actor.id,
          reason: input.reason.trim(),
        },
      });
      if (policy.activeRuleId)
        await transaction.trustRuleVersion.update({
          where: { id: policy.activeRuleId },
          data: { status: "RETIRED" },
        });
      const changed = await transaction.trustPolicyState.updateMany({
        where: { singletonId: "global", version: input.expectedPolicyVersion },
        data: { version: { increment: 1 }, activeRuleId: rule.id },
      });
      if (changed.count !== 1) throw new Error("CONFLICT");
      await transaction.auditEvent.create({
        data: {
          actorId: actor.id,
          entityType: "TrustPolicy",
          entityId: "global",
          action: "PUBLISH_RULE",
          before: { ruleId: policy.activeRuleId },
          after: { ruleId: rule.id },
          reason: input.reason.trim(),
        },
      });
      const result = { ruleId: rule.id, policyVersion: policy.version + 1 };
      await finishMutation(transaction, receipt.id, result);
      return result;
    },
    { isolationLevel: "Serializable" },
  );
}
export async function adjustTrust(
  database: PrismaClient,
  input: {
    actorId: string;
    targetId: string;
    desiredScore: number;
    expectedRuleId: string;
    reason: string;
    key: string;
  },
) {
  if (!input.reason.trim()) throw new Error("REASON_REQUIRED");
  return database.$transaction(
    async (transaction) => {
      const actor = await transaction.user.findUniqueOrThrow({
        where: { id: input.actorId },
      });
      if (actor.serviceRole !== "OPERATOR") throw new Error("FORBIDDEN");
      await transaction.user.findUniqueOrThrow({
        where: { id: input.targetId },
      });
      const receipt = await claimMutation(transaction, {
        actorId: actor.id,
        operation: "ADJUST_TRUST",
        key: input.key,
        payload: {
          targetId: input.targetId,
          desiredScore: input.desiredScore,
          expectedRuleId: input.expectedRuleId,
          reason: input.reason,
        },
      });
      if (receipt.status === "COMPLETED") return receipt.result;
      const { rule } = await readActiveRule(transaction);
      if (rule.id !== input.expectedRuleId) throw new Error("CONFLICT");
      const inputs = await trustInputs(transaction, input.targetId);
      const before = calculateTrust(rule, inputs);
      const delta = adjustmentForTarget(rule, inputs, input.desiredScore);
      await transaction.trustEvent.create({
        data: {
          userId: input.targetId,
          type: "ADJUSTMENT",
          sourceId: receipt.id,
          actorId: actor.id,
          value: delta,
          reason: input.reason.trim(),
        },
      });
      await incrementTrustInput(transaction, input.targetId);
      await transaction.auditEvent.create({
        data: {
          actorId: actor.id,
          entityType: "UserTrust",
          entityId: input.targetId,
          action: "ADJUST_TRUST",
          before: { score: before, adjustment: inputs.adjustment },
          after: { score: input.desiredScore, delta, ruleId: rule.id },
          reason: input.reason.trim(),
        },
      });
      const result = await readTrust(transaction, input.targetId);
      await finishMutation(transaction, receipt.id, result);
      return result;
    },
    { isolationLevel: "Serializable" },
  );
}
export async function reviewUser(
  database: PrismaClient,
  input: {
    actorId: string;
    targetId: string;
    value: number;
    expectedVersion?: number;
  },
) {
  if (input.actorId === input.targetId)
    throw new Error("SELF_REVIEW_FORBIDDEN");
  return database.$transaction(
    async (transaction) => {
      await transaction.user.findUniqueOrThrow({
        where: { id: input.actorId },
      });
      await transaction.user.findUniqueOrThrow({
        where: { id: input.targetId },
      });
      const { rule } = await readActiveRule(transaction);
      if (
        !Number.isFinite(input.value) ||
        input.value < rule.minReview ||
        input.value > rule.maxReview
      )
        throw new Error("VALIDATION_FAILED");
      const where = {
        reviewerId_targetId: {
          reviewerId: input.actorId,
          targetId: input.targetId,
        },
      };
      const previous = await transaction.userTrustReview.findUnique({ where });
      if (
        input.expectedVersion !== undefined &&
        input.expectedVersion !== (previous?.version ?? 0)
      )
        throw new Error("CONFLICT");
      if (previous?.value === input.value) return previous;
      const review = await transaction.userTrustReview.upsert({
        where,
        create: {
          reviewerId: input.actorId,
          targetId: input.targetId,
          value: input.value,
        },
        update: { value: input.value, version: { increment: 1 } },
      });
      await incrementTrustInput(transaction, input.targetId);
      await transaction.auditEvent.create({
        data: {
          actorId: input.actorId,
          entityType: "UserTrustReview",
          entityId: review.id,
          action: "REVIEW_USER",
          before: { value: previous?.value ?? null },
          after: { value: review.value },
          reason: "User review updated",
        },
      });
      return review;
    },
    { isolationLevel: "Serializable" },
  );
}
