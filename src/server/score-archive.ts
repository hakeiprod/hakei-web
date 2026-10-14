import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { repositoryAccess } from "./authorization";
import { claimMutation, finishMutation } from "./idempotency";
export async function archiveScore(
  database: PrismaClient,
  input: {
    actorId: string;
    scoreId: number;
    expectedRevisionId: string;
    key: string;
  },
) {
  return database.$transaction(
    async (transaction) => {
      const score = await transaction.score.findUniqueOrThrow({
        where: { id: input.scoreId },
      });
      if (!score.repositoryId) throw new Error("NOT_FOUND");
      const access = await repositoryAccess(
        transaction,
        score.repositoryId,
        input.actorId,
      );
      if (!access.canManage) throw new Error("FORBIDDEN");
      const receipt = await claimMutation(transaction, {
        actorId: input.actorId,
        operation: "ARCHIVE_SCORE",
        key: input.key,
        repositoryId: score.repositoryId,
        scoreId: score.id,
        payload: {
          scoreId: score.id,
          expectedRevisionId: input.expectedRevisionId,
        },
      });
      if (receipt.status === "COMPLETED") return receipt.result;
      const changed = await transaction.score.updateMany({
        where: {
          id: score.id,
          currentRevisionId: input.expectedRevisionId,
          archivedAt: null,
        },
        data: { archivedAt: new Date() },
      });
      if (changed.count !== 1) throw new Error("CONFLICT");
      await transaction.auditEvent.create({
        data: {
          actorId: input.actorId,
          entityType: "Score",
          entityId: String(score.id),
          action: "ARCHIVE_SCORE",
          reason: "Score archived; immutable revisions retained",
        },
      });
      const result = { scoreId: score.id, archived: true };
      await finishMutation(transaction, receipt.id, result);
      return result;
    },
    { isolationLevel: "Serializable" },
  );
}
