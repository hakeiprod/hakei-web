import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { withTestConnections } from "./testing/database";
import { GitStore } from "./git-store";
import { acceptInitialScore } from "./git-acceptance";
import { listScores, readScore } from "./score-reader";

test("current ACL protects both current and past Git revisions, lists omit unmanaged rows", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hakei-reader-"));
  try {
    await withTestConnections(async (database, second) => {
      const owner = await database.user.create({
        data: { serviceRole: "OPERATOR" },
      });
      const invited = await database.user.create({ data: {} });
      const repository = await database.scoreRepository.create({
        data: {
          name: "Music",
          ownerId: owner.id,
          gitStorageKey: randomUUID(),
          visibility: "PUBLIC",
        },
      });
      const score = await database.score.create({
        data: { data: { pitch: 99 } },
      });
      const unmanaged = await database.score.create({
        data: { data: { pitch: 88 } },
      });
      const git = new GitStore(root);
      try {
        const input = {
          actorId: owner.id,
          operation: "MIGRATE_LEGACY" as const,
          key: "first",
          repositoryId: repository.id,
          scoreId: score.id,
          candidate: { pitch: 60 },
        };
        await acceptInitialScore(database, git, input);
        const first = await readScore(second, git, score.id);
        expect(first.data).toEqual({ pitch: 60 });
        const accepted = await second.scoreRepository.findUniqueOrThrow({
          where: { id: repository.id },
        });
        await acceptInitialScore(database, git, {
          ...input,
          key: "second",
          expectedRepositoryOid: accepted.acceptedCommitOid!,
          candidate: { pitch: 62 },
        });
        const reading1 = await readScore(second, git, score.id);
        expect(reading1.data).toEqual({ pitch: 62 });
        const reading2 = await readScore(
          second,
          git,
          score.id,
          undefined,
          first.revisionId,
        );
        expect(reading2.data).toEqual({ pitch: 60 });
        expect(await listScores(second)).toEqual(
          expect.arrayContaining([expect.objectContaining({ id: score.id })]),
        );
        expect(await listScores(second)).not.toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: unmanaged.id }),
          ]),
        );
        await second.scoreRepository.update({
          where: { id: repository.id },
          data: { visibility: "INVITED" },
        });
        await second.repositoryMember.create({
          data: {
            repositoryId: repository.id,
            userId: invited.id,
            role: "VIEWER",
          },
        });
        const reading3 = await readScore(
          second,
          git,
          score.id,
          invited.id,
          first.revisionId,
        );
        expect(reading3.canEdit).toBe(false);
        await second.repositoryMember.delete({
          where: {
            repositoryId_userId: {
              repositoryId: repository.id,
              userId: invited.id,
            },
          },
        });
        await expect(
          readScore(second, git, score.id, invited.id, first.revisionId),
        ).rejects.toThrow("NOT_FOUND");
        await expect(
          readScore(second, git, unmanaged.id, owner.id),
        ).rejects.toThrow("NOT_FOUND");
        await second.scoreRepository.update({
          where: { id: repository.id },
          data: { visibility: "PRIVATE" },
        });
        await second.repositoryMember.create({
          data: {
            repositoryId: repository.id,
            userId: invited.id,
            role: "ADMIN",
          },
        });
        const reading4 = await readScore(second, git, score.id, invited.id);
        expect(reading4.canManage).toBe(true);
        await second.score.update({
          where: { id: score.id },
          data: { archivedAt: new Date() },
        });
        await expect(
          readScore(second, git, score.id, owner.id),
        ).rejects.toThrow("NOT_FOUND");
      } finally {
        await database.repositoryMember.deleteMany({
          where: { repositoryId: repository.id },
        });
        await database.gitPublicationJob.deleteMany({
          where: { repositoryId: repository.id },
        });
        await database.mutationReceipt.deleteMany({
          where: { repositoryId: repository.id },
        });
        await database.scoreRevision.deleteMany({
          where: { scoreId: score.id },
        });
        await database.score.deleteMany({
          where: { id: { in: [score.id, unmanaged.id] } },
        });
        await database.scoreRepository.delete({ where: { id: repository.id } });
        await database.user.deleteMany({
          where: { id: { in: [owner.id, invited.id] } },
        });
      }
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
