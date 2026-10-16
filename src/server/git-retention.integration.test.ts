import { expect, it } from "vitest";
import { withCollaboration, submittedDraft } from "./testing/collaboration";
import { GitStore } from "./git-store";
import { scoreGitCheckpoint, retainAndCollect } from "./git-retention";
import { withMaintenanceGate } from "./maintenance-freeze";
it("retains accepted, proposed and preparation objects through exclusive GC and detects missing backups", async () =>
  withCollaboration(async (fixture) => {
    const proposal = await submittedDraft(
      fixture,
      fixture.editorId,
      "retain-proposal",
    );
    const row = await fixture.database.editProposal.findUniqueOrThrow({
      where: { id: proposal.proposalId },
    });
    const indexed = await fixture.database.scoreRepository.findUniqueOrThrow({
        where: { id: fixture.repositoryId },
      }),
      storageKey = indexed.gitStorageKey;
    const prepared = await fixture.git.commit(
      storageKey,
      fixture.commitOid,
      { [`scores/${fixture.scoreId}/score.json`]: { preparation: true } },
      "Prepared before crash",
    );
    await fixture.git.updateRef(
      storageKey,
      "refs/operations/simulated_crash",
      prepared,
    );
    const checkpoint = await withMaintenanceGate(fixture.root, () =>
      retainAndCollect(fixture.database, fixture.git),
    );
    const repository = checkpoint.repositories.find(
      (value) => value.repositoryId === fixture.repositoryId,
    )!;
    expect(repository.protectedOids).toContain(prepared);
    expect(repository.protectedOids).toContain(fixture.commitOid);
    expect(repository.protectedOids).toContain(row.proposalCommitOid);
    expect(
      repository.refs.some(
        (reference) =>
          reference.ref === `refs/retention/${row.proposalCommitOid}`,
      ),
    ).toBe(true);
    await fixture.git.verifyCommit(
      repository.gitStorageKey,
      row.proposalCommitOid,
    );
    await expect(
      scoreGitCheckpoint(
        fixture.database,
        new GitStore(`${fixture.root}/missing`),
      ),
    ).rejects.toThrow();
  }));
it("creates one verified database/Git checkpoint and detects file tampering", async () =>
  withCollaboration(async (fixture) => {
    const { mkdtemp, rm, appendFile } = await import("node:fs/promises"),
      { tmpdir } = await import("node:os"),
      { default: path } = await import("node:path");
    const { backupScoreGit, verifyBackupFiles, verifyRestoredScoreGit } =
      await import("./score-backup");
    const parent = await mkdtemp(path.join(tmpdir(), "hakei-backup-")),
      destination = path.join(parent, "checkpoint");
    try {
      const result = await backupScoreGit(
        fixture.database,
        fixture.root,
        destination,
        process.env.TEST_DATABASE_URL!,
      );
      const manifest = await verifyBackupFiles(destination);
      expect(manifest.checkpointId).toBe(result.checkpointId);
      expect(
        await verifyRestoredScoreGit(fixture.database, destination),
      ).toMatchObject({ checkpointId: result.checkpointId });
      const { randomUUID } = await import("node:crypto"),
        { spawn } = await import("node:child_process"),
        { PrismaClient } = await import("../generated/prisma/client");
      const name = `hakei_restore_${randomUUID().replaceAll("-", "")}_test`,
        url = new URL(process.env.TEST_DATABASE_URL!);
      url.pathname = `/${name}`;
      // The identifier is generated here, contains only letters/digits/underscore, and targets a new dedicated test DB.
      await fixture.database.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
      const restored = new PrismaClient({ datasourceUrl: url.toString() });
      try {
        await new Promise<void>((resolve, reject) => {
          const child = spawn(
            "pg_restore",
            [
              "--host",
              url.hostname,
              "--port",
              url.port || "5432",
              "--username",
              decodeURIComponent(url.username),
              "--dbname",
              name,
              "--no-owner",
              "--exit-on-error",
              path.join(destination, "database.dump"),
            ],
            {
              env: {
                NODE_ENV: process.env.NODE_ENV,
                PATH: process.env.PATH,
                PGPASSWORD: decodeURIComponent(url.password),
              },
              stdio: ["ignore", "ignore", "pipe"],
            },
          );
          child.stderr.resume();
          child.on("error", reject);
          child.on("close", (code) =>
            code === 0 ? resolve() : reject(new Error("TEST_RESTORE_FAILED")),
          );
        });
        expect(
          await verifyRestoredScoreGit(restored, destination),
        ).toMatchObject({ checkpointId: result.checkpointId });
        const { recoverGitPublications } = await import("./git-publication");
        expect(
          await recoverGitPublications(
            restored,
            new GitStore(path.join(destination, "git")),
          ),
        ).toEqual([]);
      } finally {
        await restored.$disconnect();
        await fixture.database.$executeRawUnsafe(`DROP DATABASE "${name}"`);
      }
      await appendFile(path.join(destination, "database.dump"), "tampered");
      await expect(verifyBackupFiles(destination)).rejects.toThrow(
        "BACKUP_HASH_MISMATCH",
      );
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  }));
