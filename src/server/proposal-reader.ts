import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { GitStore } from "./git-store";
import { repositoryAccess } from "./authorization";
import { mergeAuthorization } from "./merge-authorization";
export async function readProposal(
  database: PrismaClient,
  git: GitStore,
  proposalId: string,
  actorId: string,
) {
  const proposal = await database.editProposal.findUnique({
    where: { id: proposalId },
  });
  if (!proposal) throw new Error("NOT_FOUND");
  const score = await database.score.findUniqueOrThrow({
    where: { id: proposal.scoreId },
  });
  if (!score.repositoryId || score.archivedAt) throw new Error("NOT_FOUND");
  const access = await repositoryAccess(database, score.repositoryId, actorId);
  if (
    proposal.status === "DRAFT" &&
    proposal.authorId !== actorId &&
    !access.canManage
  )
    throw new Error("NOT_FOUND");
  const revision = await database.scoreRevision.findFirstOrThrow({
    where: {
      id: proposal.baseRevisionId,
      scoreId: score.id,
      repositoryId: score.repositoryId,
    },
  });
  const [base, candidate] = await Promise.all([
    git.readJson(
      access.repository.gitStorageKey,
      revision.commitOid,
      revision.path,
    ),
    git.readJson(
      access.repository.gitStorageKey,
      proposal.proposalCommitOid,
      `scores/${score.id}/score.json`,
    ),
  ]);
  let canMerge = false,
    mergeReason = "";
  try {
    await database.$transaction(
      (transaction) =>
        mergeAuthorization(transaction, score.repositoryId!, actorId),
      { isolationLevel: "Serializable" },
    );
    canMerge = true;
  } catch (error) {
    if (error instanceof Error && error.message === "TRUST_UNCONFIGURED")
      mergeReason = "信頼度の基準がまだ設定されていません。";
    else if (error instanceof Error && error.message === "INSUFFICIENT_TRUST")
      mergeReason = "マージに必要な信頼度を満たしていません。";
    else if (error instanceof Error && error.message === "FORBIDDEN")
      mergeReason = "マージ権限がありません。";
    else throw error;
  }
  return {
    id: proposal.id,
    scoreId: score.id,
    repositoryId: score.repositoryId,
    baseRevisionId: proposal.baseRevisionId,
    baseRepositoryCommitOid: proposal.baseRepositoryCommitOid,
    status: proposal.status,
    version: proposal.version,
    summary: proposal.summary,
    base,
    candidate,
    canMerge,
    mergeReason,
    canEdit:
      proposal.status === "DRAFT" &&
      proposal.authorId === actorId &&
      access.canEdit,
    canWithdraw:
      proposal.authorId === actorId &&
      proposal.status !== "MERGED" &&
      proposal.status !== "WITHDRAWN",
  };
}
