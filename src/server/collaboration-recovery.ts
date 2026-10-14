import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { GitStore } from "./git-store";
import { readRevisionArtifacts } from "./revision-validation";
import { createScore } from "./score-creation";
import { mergeProposal } from "./merge-proposal";
/** Resume prepared collaboration without retaining upload bytes or candidate copies in DB. */
export async function recoverCollaborationPreparations(
  database: PrismaClient,
  git: GitStore,
) {
  const receipts = await database.mutationReceipt.findMany({
    where: {
      status: "PREPARING",
      operation: { in: ["CREATE_SCORE", "MERGE_PROPOSAL"] },
    },
  });
  const results: { operationId: string; status: string }[] = [];
  for (const receipt of receipts) {
    try {
      if (!receipt.repositoryId || !receipt.scoreId)
        throw new Error("REPAIR_REQUIRED");
      if (receipt.operation === "MERGE_PROPOSAL") {
        if (
          !receipt.proposalId ||
          !receipt.expectedRevisionId ||
          !receipt.expectedRepositoryOid
        )
          throw new Error("REPAIR_REQUIRED");
        const proposal = await database.editProposal.findUniqueOrThrow({
          where: { id: receipt.proposalId },
        });
        await mergeProposal(database, git, {
          actorId: receipt.actorId,
          proposalId: proposal.id,
          expectedProposalVersion: proposal.version,
          expectedRevisionId: receipt.expectedRevisionId,
          expectedRepositoryCommitOid: receipt.expectedRepositoryOid,
          key: receipt.key,
        });
      } else {
        const repository = await database.scoreRepository.findUniqueOrThrow({
          where: { id: receipt.repositoryId },
        });
        if (receipt.stage === "CLAIMED" && !receipt.preparedCommitOid)
          await git.initialize(repository.gitStorageKey);
        const oid = await git.readRef(
          repository.gitStorageKey,
          `refs/operations/${receipt.id}`,
        );
        if (!oid) {
          results.push({
            operationId: receipt.id,
            status: "AWAITING_RESUBMISSION",
          });
          continue;
        }
        const candidate = await git.readJson(
          repository.gitStorageKey,
          oid,
          `scores/${receipt.scoreId}/score.json`,
        );
        const artifacts = await readRevisionArtifacts(
          git,
          repository.gitStorageKey,
          oid,
          receipt.scoreId,
        );
        await createScore(database, git, {
          artifacts: artifacts?.metadata ? artifacts : undefined,
          actorId: receipt.actorId,
          repositoryId: repository.id,
          candidate,
          key: receipt.key,
        });
      }
      results.push({ operationId: receipt.id, status: "RECOVERED" });
    } catch (error) {
      results.push({
        operationId: receipt.id,
        status: error instanceof Error ? error.message : "Recovery failed",
      });
    }
  }
  return results;
}
