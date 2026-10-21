import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { withTestConnections } from "./testing/database";
import { GitStore } from "./git-store";
import {
  assignLegacyScore,
  migrateLegacyScores,
} from "./legacy-score-assignment";
import { repositoryAccess } from "./authorization";

test("legacy IDs and JSON survive migration; no owner is invented; assignment is explicit and audited", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hakei-legacy-"));
  try {
    await withTestConnections(async (database) => {
      const operator = await database.user.create({
        data: { serviceRole: "OPERATOR" },
      });
      const user = await database.user.create({ data: {} });
      const original = { notes: [{ pitch: 60 }], nested: { preserved: true } };
      const score = await database.score.create({ data: { data: original } });
      const repositoryId = `legacy_${score.id}`;
      try {
        const manifest = await migrateLegacyScores(
          database,
          new GitStore(root),
          operator.id,
        );
        expect(manifest.scores).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ scoreId: score.id }),
          ]),
        );
        expect(
          await database.score.findUnique({ where: { id: score.id } }),
        ).toMatchObject({
          data: original,
          repositoryId: null,
          currentRevisionId: null,
        });
        const quarantined = await database.scoreRepository.findUniqueOrThrow({
          where: { id: repositoryId },
        });
        expect(quarantined.ownerId).toBeNull();
        for (const actor of [undefined, user.id, operator.id])
          await expect(
            repositoryAccess(database, repositoryId, actor),
          ).rejects.toThrow("NOT_FOUND");
        await migrateLegacyScores(database, new GitStore(root), operator.id);
        expect(
          await database.scoreRevision.count({ where: { scoreId: score.id } }),
        ).toBe(1);
        await expect(
          assignLegacyScore(database, {
            actorId: user.id,
            ownerId: user.id,
            scoreId: score.id,
            reason: "self assignment",
            key: "forbidden",
          }),
        ).rejects.toThrow("FORBIDDEN");
        const input = {
          actorId: operator.id,
          ownerId: user.id,
          scoreId: score.id,
          reason: "Owner verified",
          key: "assignment",
        };
        await assignLegacyScore(database, input);
        await assignLegacyScore(database, input);
        expect(
          await database.auditEvent.findMany({
            where: {
              entityId: String(score.id),
              action: "ASSIGN_LEGACY_OWNER",
            },
          }),
        ).toHaveLength(1);
        const access = await repositoryAccess(database, repositoryId, user.id);
        expect(access.canManage).toBe(true);
        await expect(
          repositoryAccess(database, repositoryId, operator.id),
        ).rejects.toThrow("NOT_FOUND");
      } finally {
        await database.auditEvent.deleteMany({
          where: { entityId: String(score.id) },
        });
        await database.gitPublicationJob.deleteMany({
          where: { repositoryId },
        });
        await database.mutationReceipt.deleteMany({ where: { repositoryId } });
        await database.scoreRevision.deleteMany({
          where: { scoreId: score.id },
        });
        await database.score.delete({ where: { id: score.id } });
        await database.scoreRepository.deleteMany({
          where: { id: repositoryId },
        });
        await database.user.deleteMany({
          where: { id: { in: [operator.id, user.id] } },
        });
      }
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
