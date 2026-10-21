import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { GitStore } from "./git-store";
import { payloadHash } from "./contracts";
export async function scoreGitCheckpoint(
  database: PrismaClient,
  git: GitStore,
) {
  const repositories = await database.scoreRepository.findMany({
      orderBy: { id: "asc" },
    }),
    revisions = await database.scoreRevision.findMany({
      orderBy: { id: "asc" },
    }),
    proposals = await database.editProposal.findMany(),
    receipts = await database.mutationReceipt.findMany(),
    jobs = await database.gitPublicationJob.findMany();
  const scores = await database.score.findMany({
    select: { id: true, repositoryId: true },
  });
  const mapped = new Map(scores.map((score) => [score.id, score.repositoryId]));
  const checkpoint = [];
  for (const repository of repositories) {
    const protectedOids = new Set<string>();
    if (repository.acceptedCommitOid)
      protectedOids.add(repository.acceptedCommitOid);
    for (const revision of revisions.filter(
      (row) => row.repositoryId === repository.id,
    )) {
      await git.verifyCommit(repository.gitStorageKey, revision.commitOid);
      if (
        payloadHash(
          await git.readJson(
            repository.gitStorageKey,
            revision.commitOid,
            revision.path,
          ),
        ) !== revision.dataHash
      )
        throw new Error("BACKUP_BLOB_MISMATCH");
      protectedOids.add(revision.commitOid);
    }
    for (const proposal of proposals.filter(
      (row) => mapped.get(row.scoreId) === repository.id,
    )) {
      protectedOids.add(proposal.baseRepositoryCommitOid);
      protectedOids.add(proposal.proposalCommitOid);
    }
    for (const receipt of receipts.filter(
      (row) => row.repositoryId === repository.id,
    )) {
      if (receipt.preparedCommitOid)
        protectedOids.add(receipt.preparedCommitOid);
    }
    for (const job of jobs.filter(
      (row) => row.repositoryId === repository.id,
    )) {
      protectedOids.add(job.targetOid);
    }
    const exists = await git.repositoryExists(repository.gitStorageKey);
    if (exists) await git.verifyRepository(repository.gitStorageKey);
    const references_ = exists
      ? await git.listRefs(repository.gitStorageKey)
      : [];
    for (const reference of references_) protectedOids.add(reference.oid);
    for (const oid of protectedOids)
      await git.verifyCommit(repository.gitStorageKey, oid);
    checkpoint.push({
      repositoryId: repository.id,
      gitStorageKey: repository.gitStorageKey,
      acceptedCommitOid: repository.acceptedCommitOid,
      acceptedGeneration: repository.acceptedGeneration,
      syncState: repository.syncState,
      refs: references_,
      protectedOids: [...protectedOids].toSorted(),
    });
  }
  // Every practice FK refers to one of these retained revision commits.
  const references = await database.practiceSession.findMany({
    select: { scoreRevisionId: true },
  });
  if (
    references.some(
      (row) =>
        !revisions.some((revision) => revision.id === row.scoreRevisionId),
    )
  )
    throw new Error("BACKUP_REVISION_MISSING");
  return {
    objectFormat: "sha1" as const,
    repositories: checkpoint,
    revisions: revisions.map(
      ({ id, repositoryId, scoreId, commitOid, path, dataHash }) => ({
        id,
        repositoryId,
        scoreId,
        commitOid,
        path,
        dataHash,
      }),
    ),
  };
}
/** Caller must hold the exclusive maintenance gate through verification and GC. */
export async function retainAndCollect(database: PrismaClient, git: GitStore) {
  const checkpoint = await scoreGitCheckpoint(database, git);
  for (const repository of checkpoint.repositories) {
    for (const oid of repository.protectedOids)
      await git.retainCommit(repository.gitStorageKey, oid);
    if (repository.protectedOids.length > 0)
      await git.garbageCollect(repository.gitStorageKey);
  }
  return scoreGitCheckpoint(database, git);
}
