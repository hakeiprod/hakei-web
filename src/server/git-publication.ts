import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { GitStore } from "./git-store";
import { leaseOperation, releaseOperation } from "./git-operation";

/** DB accepted OID is authoritative. Publishing never repeats score/trust mutations. */
export async function publishGitOperation(
  database: PrismaClient,
  git: GitStore,
  operationId: string,
) {
  const lease = await leaseOperation(database, operationId);
  try {
    const job = await database.gitPublicationJob.findUniqueOrThrow({
      where: { operationId },
    });
    if (job.status === "COMPLETED") return;
    const repository = await database.scoreRepository.findUniqueOrThrow({
      where: { id: job.repositoryId },
    });
    if (
      repository.acceptedCommitOid !== job.targetOid ||
      repository.acceptedGeneration !== job.generation
    ) {
      await markRepair(
        database,
        job.id,
        repository.id,
        "Accepted pointer/generation mismatch",
      );
      throw new Error("REPAIR_REQUIRED");
    }
    const current = await git.readRef(
      repository.gitStorageKey,
      "refs/heads/main",
    );
    if (current !== job.targetOid) {
      if (current !== (job.expectedOldOid ?? undefined)) {
        await markRepair(
          database,
          job.id,
          repository.id,
          "Unexpected main OID",
        );
        throw new Error("REPAIR_REQUIRED");
      }
      await git.updateRef(
        repository.gitStorageKey,
        "refs/heads/main",
        job.targetOid,
        current,
      );
    }
    await database.$transaction(
      async (transaction) => {
        await transaction.gitPublicationJob.update({
          where: { id: job.id },
          data: {
            status: "COMPLETED",
            attempts: { increment: 1 },
            lastError: null,
          },
        });
        await transaction.mutationReceipt.update({
          where: { id: operationId },
          data: { stage: "REF_PUBLISHED" },
        });
        const updated = await transaction.scoreRepository.updateMany({
          where: {
            id: repository.id,
            acceptedCommitOid: job.targetOid,
            acceptedGeneration: job.generation,
            syncState: "PENDING_PUBLICATION",
          },
          data: { syncState: "READY" },
        });
        if (updated.count !== 1 && repository.syncState !== "READY")
          throw new Error("CONFLICT");
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    await database.gitPublicationJob.updateMany({
      where: { operationId, status: "PENDING" },
      data: {
        attempts: { increment: 1 },
        lastError:
          error instanceof Error
            ? error.message.slice(0, 1000)
            : "Publication failed",
      },
    });
    throw error;
  } finally {
    await releaseOperation(database, operationId, lease);
  }
}
async function markRepair(
  database: PrismaClient,
  jobId: string,
  repositoryId: string,
  reason: string,
) {
  await database.$transaction([
    database.gitPublicationJob.update({
      where: { id: jobId },
      data: { status: "REPAIR_REQUIRED", lastError: reason },
    }),
    database.scoreRepository.update({
      where: { id: repositoryId },
      data: { syncState: "REPAIR_REQUIRED" },
    }),
  ]);
}
export async function recoverGitPublications(
  database: PrismaClient,
  git: GitStore,
) {
  const jobs = await database.gitPublicationJob.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });
  const results: { operationId: string; error?: string }[] = [];
  for (const job of jobs) {
    try {
      await publishGitOperation(database, git, job.operationId);
      results.push({ operationId: job.operationId });
    } catch (error) {
      results.push({
        operationId: job.operationId,
        error: error instanceof Error ? error.message : "Recovery failed",
      });
    }
  }
  return results;
}
