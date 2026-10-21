"use server";
import { z } from "zod";
import { prisma } from "@/prisma";
import { runAction } from "@/server/action-result";
import * as trust from "@/server/trust";
export async function publishTrustRule(input: unknown) {
  return runAction((actor) =>
    trust.publishTrustRule(prisma, {
      ...z
        .object({
          rule: z.unknown(),
          expectedPolicyVersion: z.int().nonnegative(),
          reason: z.string().min(1).max(2000),
          key: z.string(),
        })
        .parse(input),
      actorId: actor.id,
    }),
  );
}
export async function adjustTrust(input: unknown) {
  return runAction((actor) =>
    trust.adjustTrust(prisma, {
      ...z
        .object({
          targetId: z.string(),
          desiredScore: z.number().finite(),
          expectedRuleId: z.string(),
          reason: z.string().min(1).max(2000),
          key: z.string(),
        })
        .parse(input),
      actorId: actor.id,
    }),
  );
}
export async function reviewUser(input: unknown) {
  return runAction((actor) =>
    trust.reviewUser(prisma, {
      ...z
        .object({
          targetId: z.string(),
          value: z.number().finite(),
          expectedVersion: z.int().nonnegative().optional(),
        })
        .parse(input),
      actorId: actor.id,
    }),
  );
}
export async function readTrust(input: unknown) {
  return runAction(async (actor) => {
    const { userId } = z.object({ userId: z.string() }).parse(input);
    if (userId !== actor.id && actor.serviceRole !== "OPERATOR")
      throw new Error("FORBIDDEN");
    return prisma.$transaction(
      (transaction) => trust.readTrust(transaction, userId),
      { isolationLevel: "Serializable" },
    );
  });
}
