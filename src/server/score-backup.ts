import "server-only";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
  mkdir,
  cp,
  readdir,
  writeFile,
  readFile,
  stat,
} from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { GitStore } from "./git-store";
import { withMaintenanceGate } from "./maintenance-freeze";
import { retainAndCollect, scoreGitCheckpoint } from "./git-retention";
import { payloadHash } from "./contracts";
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const manifestSchema = z
  .object({
    version: z.literal(1),
    checkpointId: z.string().uuid(),
    createdAt: z.string(),
    databaseFile: z.literal("database.dump"),
    databaseHash: digest,
    gitFiles: z.array(z.object({ path: z.string().min(1), sha256: digest })),
    checkpoint: z.json(),
    checkpointHash: digest,
  })
  .strict();
async function fileHash(file: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
async function files(
  root: string,
  directory = root,
): Promise<{ path: string; sha256: string }[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const result: { path: string; sha256: string }[] = [];
  for (const entry of entries.toSorted((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  )) {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error("BACKUP_SYMLINK_FORBIDDEN");
    if (entry.isDirectory()) result.push(...(await files(root, file)));
    else if (entry.isFile())
      result.push({
        path: path.relative(root, file),
        sha256: await fileHash(file),
      });
    else throw new Error("BACKUP_FILE_TYPE");
  }
  return result;
}
async function dumpDatabase(urlValue: string, file: string) {
  const url = new URL(urlValue);
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("BACKUP_REQUIRES_POSTGRESQL");
  const arguments_ = [
    "--host",
    url.hostname,
    "--port",
    url.port || "5432",
    "--username",
    decodeURIComponent(url.username),
    "--dbname",
    decodeURIComponent(url.pathname.slice(1)),
    "--format=custom",
    "--file",
    file,
    "--no-password",
  ];
  await new Promise<void>((resolve, reject) => {
    const child = spawn("pg_dump", arguments_, {
      shell: false,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        PATH: process.env.PATH,
        HOME: tmpdir(),
        PGPASSWORD: decodeURIComponent(url.password),
        PGSSLMODE: url.searchParams.get("sslmode") ?? "prefer",
      },
      stdio: ["ignore", "ignore", "pipe"],
    });
    const timeout = setTimeout(() => child.kill("SIGKILL"), 300_000);
    child.stderr.resume();
    child.on("error", () => {
      clearTimeout(timeout);
      reject(new Error("DATABASE_BACKUP_FAILED"));
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error("DATABASE_BACKUP_FAILED"));
    });
  });
}
export async function backupScoreGit(
  database: PrismaClient,
  root: string,
  destination: string,
  url: string,
) {
  if (
    !path.isAbsolute(destination) ||
    !path.isAbsolute(root) ||
    destination === root ||
    destination.startsWith(`${root}/`) ||
    root.startsWith(`${destination}/`)
  )
    throw new Error("INVALID_BACKUP_DESTINATION");
  await mkdir(destination, { mode: 0o700 });
  return withMaintenanceGate(root, async (checkpointId) => {
    const source = new GitStore(root);
    await retainAndCollect(database, source);
    const checkpoint = await scoreGitCheckpoint(database, source);
    await dumpDatabase(url, path.join(destination, "database.dump"));
    const target = path.join(destination, "git");
    await mkdir(target, { mode: 0o700 });
    for (const repository of checkpoint.repositories) {
      if (repository.protectedOids.length === 0) continue;
      await cp(
        path.join(root, `${repository.gitStorageKey}.git`),
        path.join(target, `${repository.gitStorageKey}.git`),
        { recursive: true, errorOnExist: true, force: false },
      );
    }
    const copied = await scoreGitCheckpoint(database, new GitStore(target));
    if (payloadHash(copied) !== payloadHash(checkpoint))
      throw new Error("BACKUP_CHECKPOINT_MISMATCH");
    const manifest = {
      version: 1 as const,
      checkpointId,
      createdAt: new Date().toISOString(),
      databaseFile: "database.dump" as const,
      databaseHash: await fileHash(path.join(destination, "database.dump")),
      gitFiles: await files(target),
      checkpoint,
      checkpointHash: payloadHash(checkpoint),
    };
    await writeFile(
      path.join(destination, "manifest.json"),
      JSON.stringify(manifest, null, 2),
      { flag: "wx", mode: 0o600 },
    );
    await verifyBackupFiles(destination);
    return {
      checkpointId: manifest.checkpointId,
      repositories: checkpoint.repositories.length,
    };
  });
}
export async function verifyBackupFiles(destination: string) {
  const manifest = manifestSchema.parse(
    JSON.parse(await readFile(path.join(destination, "manifest.json"), "utf8")),
  );
  if (
    payloadHash(manifest.checkpoint) !== manifest.checkpointHash ||
    (await fileHash(path.join(destination, manifest.databaseFile))) !==
      manifest.databaseHash ||
    payloadHash(await files(path.join(destination, "git"))) !==
      payloadHash(manifest.gitFiles)
  )
    throw new Error("BACKUP_HASH_MISMATCH");
  const dump = await stat(path.join(destination, manifest.databaseFile));
  if (dump.size === 0) throw new Error("BACKUP_EMPTY_DATABASE");
  return manifest;
}
export async function verifyRestoredScoreGit(
  database: PrismaClient,
  destination: string,
) {
  const manifest = await verifyBackupFiles(destination);
  const checkpoint = await scoreGitCheckpoint(
    database,
    new GitStore(path.join(destination, "git")),
  );
  if (payloadHash(checkpoint) !== manifest.checkpointHash)
    throw new Error("BACKUP_RESTORED_DB_MISMATCH");
  return {
    checkpointId: manifest.checkpointId,
    repositories: checkpoint.repositories.length,
  };
}
