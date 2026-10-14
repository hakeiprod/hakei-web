import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { withTestConnections } from "./testing/database";
import { GitStore } from "./git-store";
import {
  acceptInitialScore,
  recoverInitialPreparations,
} from "./git-acceptance";
import { recoverGitPublications } from "./git-publication";
import { claimMutation } from "./idempotency";

for (const scenario of [
  "missing-object",
  "unexpected-main",
  "already-published",
] as const) {
  test(`publication recovery handles ${scenario}`, async () => {
    const root = await mkdtemp(path.join(tmpdir(), "hakei-publication-"));
    try {
      await withTestConnections(async (database, restart) => {
        const actor = await database.user.create({
          data: { serviceRole: "OPERATOR" },
        });
        const repository = await database.scoreRepository.create({
          data: {
            name: "test",
            ownerId: actor.id,
            gitStorageKey: randomUUID(),
          },
        });
        const score = await database.score.create({
          data: { data: { pitch: 60 } },
        });
        const input = {
          actorId: actor.id,
          operation: "MIGRATE_LEGACY" as const,
          key: "initial",
          repositoryId: repository.id,
          scoreId: score.id,
          candidate: { pitch: 60 },
        };
        const git = new GitStore(root);
        try {
          if (scenario === "missing-object") {
            const receipt = await claimMutation(database, {
              ...input,
              payload: {
                candidate: input.candidate,
                scoreId: input.scoreId,
                expectedRepositoryOid: null,
                operationPayload: null,
              },
            });
            expect(
              await recoverInitialPreparations(restart, git),
            ).toContainEqual({
              operationId: receipt.id,
              status: "AWAITING_RESUBMISSION",
            });
            expect(
              await restart.scoreRevision.count({
                where: { scoreId: score.id },
              }),
            ).toBe(0);
            await acceptInitialScore(restart, git, input);
          } else {
            await expect(
              acceptInitialScore(database, git, input, (stage) => {
                if (stage === "DB_APPLIED") throw new Error("STOP");
              }),
            ).rejects.toThrow("STOP");
            const adopted = await restart.scoreRepository.findUniqueOrThrow({
              where: { id: repository.id },
            });
            if (scenario === "unexpected-main") {
              const foreign = await git.commit(
                repository.gitStorageKey,
                undefined,
                { [`scores/${score.id}/score.json`]: { pitch: 61 } },
                "foreign",
              );
              await git.updateRef(
                repository.gitStorageKey,
                "refs/heads/main",
                foreign,
              );
              expect(await recoverGitPublications(restart, git)).toContainEqual(
                expect.objectContaining({ error: "REPAIR_REQUIRED" }),
              );
              expect(
                await restart.scoreRepository.findUnique({
                  where: { id: repository.id },
                }),
              ).toMatchObject({
                syncState: "REPAIR_REQUIRED",
                acceptedCommitOid: adopted.acceptedCommitOid,
              });
              expect(
                await git.readRef(repository.gitStorageKey, "refs/heads/main"),
              ).toBe(foreign);
            } else {
              await git.updateRef(
                repository.gitStorageKey,
                "refs/heads/main",
                adopted.acceptedCommitOid!,
              );
              await recoverGitPublications(restart, git);
              await recoverGitPublications(restart, git);
              expect(
                await restart.scoreRepository.findUnique({
                  where: { id: repository.id },
                }),
              ).toMatchObject({ syncState: "READY", acceptedGeneration: 1 });
            }
          }
          expect(
            await restart.scoreRevision.count({ where: { scoreId: score.id } }),
          ).toBe(1);
        } finally {
          await database.gitPublicationJob.deleteMany({
            where: { repositoryId: repository.id },
          });
          await database.mutationReceipt.deleteMany({
            where: { repositoryId: repository.id },
          });
          await database.scoreRevision.deleteMany({
            where: { scoreId: score.id },
          });
          await database.score.delete({ where: { id: score.id } });
          await database.scoreRepository.delete({
            where: { id: repository.id },
          });
          await database.user.delete({ where: { id: actor.id } });
        }
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}
