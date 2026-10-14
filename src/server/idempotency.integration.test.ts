import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { withTestConnections } from "./testing/database";
import { claimMutation, finishMutation } from "./idempotency";

test("two concurrent claims identify the same receipt; changed payload conflicts", async () => {
  await withTestConnections(async (first, second) => {
    const actorId = randomUUID();
    const input = {
      actorId,
      operation: "INITIAL_SCORE",
      key: "same",
      repositoryId: "repo",
      payload: { score: 1 },
    };
    try {
      const claims = await Promise.all([
        claimMutation(first, input),
        claimMutation(second, input),
      ]);
      expect(claims[0].id).toBe(claims[1].id);
      expect(await first.mutationReceipt.count({ where: { actorId } })).toBe(1);
      await expect(
        claimMutation(first, { ...input, payload: { score: 2 } }),
      ).rejects.toThrow("CONFLICT");
    } finally {
      await first.mutationReceipt.deleteMany({ where: { actorId } });
    }
  });
});

test("receipt and business update roll back together; completed result survives archived data", async () => {
  await withTestConnections(async (database) => {
    const actorId = randomUUID();
    const input = {
      actorId,
      operation: "ARCHIVE_SCORE",
      key: "archive",
      repositoryId: "repo",
      payload: { score: 1 },
    };
    const score = await database.score.create({ data: { data: { note: 60 } } });
    try {
      await expect(
        database.$transaction(async (transaction) => {
          const receipt = await claimMutation(transaction, input);
          await transaction.score.update({
            where: { id: score.id },
            data: { archivedAt: new Date() },
          });
          await finishMutation(transaction, receipt.id, { scoreId: score.id });
          throw new Error("ROLLBACK");
        }),
      ).rejects.toThrow("ROLLBACK");
      expect(await database.mutationReceipt.count({ where: { actorId } })).toBe(
        0,
      );
      expect(
        await database.score.findUnique({ where: { id: score.id } }),
      ).toMatchObject({ archivedAt: null });
      await database.$transaction(async (transaction) => {
        const receipt = await claimMutation(transaction, input);
        await transaction.score.update({
          where: { id: score.id },
          data: { archivedAt: new Date() },
        });
        await finishMutation(transaction, receipt.id, { scoreId: score.id });
      });
      const repeated = await claimMutation(database, {
        ...input,
        payload: { score: 1 },
      });
      expect(repeated.acquired).toBe(false);
      expect(repeated.result).toEqual({ scoreId: score.id });
      expect(repeated.status).toBe("COMPLETED");
    } finally {
      await database.mutationReceipt.deleteMany({ where: { actorId } });
      await database.score.delete({ where: { id: score.id } });
    }
  });
});
