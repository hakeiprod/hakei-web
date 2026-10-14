import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { withTestConnections } from "./testing/database";
import { GitStore } from "./git-store";
import {
  recoverInitialPreparations,
  type AcceptanceStage,
} from "./git-acceptance";
import { recoverGitPublications } from "./git-publication";

for (const stage of [
  "REF_PREPARED",
  "OBJECT_RECORDED",
  "DB_APPLIED",
  "REF_PUBLISHED",
] as AcceptanceStage[]) {
  test(`stopping after ${stage} resumes with one revision and no duplicate adoption`, async () => {
    const root = await mkdtemp(path.join(tmpdir(), "hakei-acceptance-"));
    try {
      await withTestConnections(async (database, restart) => {
        const actor = await database.user.create({
          data: { serviceRole: "OPERATOR" },
        });
        const repository = await database.scoreRepository.create({
          data: {
            name: "legacy",
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
        try {
          const git = new GitStore(root);
          await expect(
            promisify(execFile)(
              process.execPath,
              [
                "--conditions=react-server",
                "--import",
                "tsx",
                "src/server/testing/acceptance-worker.ts",
                root,
                JSON.stringify(input),
                stage,
              ],
              {
                env: {
                  ...process.env,
                  DATABASE_URL: process.env.TEST_DATABASE_URL,
                },
                timeout: 10_000,
              },
            ),
          ).rejects.toMatchObject({ code: 97 });
          // Model lease expiry after the crashed worker; its finally block did not run.
          await restart.mutationReceipt.updateMany({
            where: { actorId: actor.id },
            data: { leaseUntil: new Date(0) },
          });
          const receipt = await restart.mutationReceipt.findFirstOrThrow({
            where: { actorId: actor.id },
          });
          // Recover the candidate solely from the durable operation ref; original payload is discarded.
          const oid = await new GitStore(root).readRef(
            repository.gitStorageKey,
            `refs/operations/${receipt.id}`,
          );
          const candidate = await new GitStore(root).readJson(
            repository.gitStorageKey,
            oid!,
            `scores/${score.id}/score.json`,
          );
          expect(candidate).toEqual({ pitch: 60 });
          await recoverInitialPreparations(restart, new GitStore(root));
          expect(
            await recoverGitPublications(restart, new GitStore(root)),
          ).not.toEqual(
            expect.arrayContaining([
              expect.objectContaining({ error: expect.any(String) }),
            ]),
          );
          expect(
            await restart.scoreRevision.count({ where: { scoreId: score.id } }),
          ).toBe(1);
          const adopted = await restart.scoreRepository.findUniqueOrThrow({
            where: { id: repository.id },
          });
          expect(adopted.acceptedGeneration).toBe(1);
          expect(adopted.syncState).toBe("READY");
          expect(
            await git.readRef(repository.gitStorageKey, "refs/heads/main"),
          ).toBe(adopted.acceptedCommitOid);
        } finally {
          await database.gitPublicationJob.deleteMany({
            where: { repositoryId: repository.id },
          });
          await database.mutationReceipt.deleteMany({
            where: { actorId: actor.id },
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
