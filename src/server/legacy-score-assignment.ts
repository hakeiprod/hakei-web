import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { GitStore } from "./git-store";
import { acceptInitialScore } from "./git-acceptance";
import { payloadHash } from "./contracts";
import { claimMutation, finishMutation } from "./idempotency";

export async function migrateLegacyScores(
  database: PrismaClient,
  git: GitStore,
  actorId: string,
) {
  const actor = await database.user.findUniqueOrThrow({
    where: { id: actorId },
  });
  if (actor.serviceRole !== "OPERATOR") throw new Error("FORBIDDEN");
  const scores = await database.score.findMany({
    where: { repositoryId: null },
    orderBy: { id: "asc" },
  });
  const manifest: { scoreId: number; hash: string; revisionId: string }[] = [];
  for (const score of scores) {
    if (score.data === null)
      throw new Error(`Legacy score ${score.id} has no source JSON`);
    const hash = payloadHash(score.data);
    let revision = await database.scoreRevision.findFirst({
      where: { scoreId: score.id },
      orderBy: { number: "asc" },
    });
    if (!revision) {
      const repository = await database.scoreRepository.upsert({
        where: { id: `legacy_${score.id}` },
        create: {
          id: `legacy_${score.id}`,
          name: `Unassigned score ${score.id}`,
          gitStorageKey: `legacy_${score.id}`,
        },
        update: {},
      });
      await acceptInitialScore(database, git, {
        actorId,
        operation: "MIGRATE_LEGACY",
        key: `legacy-${score.id}`,
        repositoryId: repository.id,
        scoreId: score.id,
        candidate: score.data,
      });
      revision = await database.scoreRevision.findFirstOrThrow({
        where: { scoreId: score.id },
        orderBy: { number: "asc" },
      });
    }
    const repository = await database.scoreRepository.findUniqueOrThrow({
      where: { id: revision.repositoryId },
    });
    const saved = await git.readJson(
      repository.gitStorageKey,
      revision.commitOid,
      revision.path,
    );
    const current = await database.score.findUniqueOrThrow({
      where: { id: score.id },
    });
    if (
      payloadHash(saved) !== hash ||
      payloadHash(current.data) !== hash ||
      revision.dataHash !== hash
    )
      throw new Error(`Legacy score ${score.id} integrity mismatch`);
    manifest.push({ scoreId: score.id, hash, revisionId: revision.id });
  }
  return { count: scores.length, scores: manifest };
}
export async function assignLegacyScore(
  database: PrismaClient,
  input: {
    actorId: string;
    scoreId: number;
    ownerId: string;
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
        where: { id: input.ownerId },
      });
      const repositoryId = `legacy_${input.scoreId}`;
      const receipt = await claimMutation(transaction, {
        actorId: input.actorId,
        operation: "ASSIGN_OWNERSHIP",
        key: input.key,
        repositoryId,
        payload: {
          scoreId: input.scoreId,
          ownerId: input.ownerId,
          reason: input.reason,
        },
      });
      if (receipt.status === "COMPLETED") return receipt.result;
      const revision = await transaction.scoreRevision.findFirstOrThrow({
        where: { scoreId: input.scoreId, repositoryId },
        orderBy: { number: "desc" },
      });
      const repository = await transaction.scoreRepository.findUniqueOrThrow({
        where: { id: repositoryId },
      });
      if (repository.syncState !== "READY" || repository.ownerId)
        throw new Error("CONFLICT");
      const changed = await transaction.score.updateMany({
        where: {
          id: input.scoreId,
          repositoryId: null,
          currentRevisionId: null,
        },
        data: { repositoryId, currentRevisionId: revision.id },
      });
      if (changed.count !== 1) throw new Error("CONFLICT");
      await transaction.scoreRepository.update({
        where: { id: repositoryId },
        data: { ownerId: input.ownerId, accessVersion: { increment: 1 } },
      });
      await transaction.auditEvent.create({
        data: {
          actorId: input.actorId,
          entityType: "Score",
          entityId: String(input.scoreId),
          action: "ASSIGN_LEGACY_OWNER",
          before: { ownerId: null },
          after: { ownerId: input.ownerId },
          reason: input.reason.trim(),
        },
      });
      const result = {
        scoreId: input.scoreId,
        repositoryId,
        revisionId: revision.id,
      };
      await finishMutation(transaction, receipt.id, result);
      return result;
    },
    { isolationLevel: "Serializable" },
  );
}
