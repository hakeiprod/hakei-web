import { verifyTransactionActor } from "./authentication/authorize";
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { GitStore } from "./git-store";
import { acceptScoreChange, type AcceptanceStage } from "./git-acceptance";
import { mergeAuthorization } from "./merge-authorization";
import { incrementTrustInput } from "./trust";
import { readRevisionArtifacts } from "./revision-validation";
import { repositoryAccess } from "./authorization";
export async function mergeProposal(
  database: PrismaClient,
  git: GitStore,
  input: {
    actorId: string;
    proposalId: string;
    expectedProposalVersion: number;
    expectedRevisionId: string;
    expectedRepositoryCommitOid: string;
    key: string;
  },
  afterStage?: (stage: AcceptanceStage) => void | Promise<void>,
) {
  const proposal = await database.editProposal.findUniqueOrThrow({
    where: { id: input.proposalId },
  });
  const score = await database.score.findUniqueOrThrow({
    where: { id: proposal.scoreId },
  });
  if (!score.repositoryId || score.archivedAt) throw new Error("NOT_FOUND");
  const access = await repositoryAccess(
    database,
    score.repositoryId,
    input.actorId,
  );
  const candidate = await git.readJson(
    access.repository.gitStorageKey,
    proposal.proposalCommitOid,
    `scores/${score.id}/score.json`,
  );
  const artifacts = await readRevisionArtifacts(
    git,
    access.repository.gitStorageKey,
    proposal.proposalCommitOid,
    score.id,
  );
  let proof: Awaited<ReturnType<typeof mergeAuthorization>> | undefined;
  try {
    return await acceptScoreChange(
      database,
      git,
      {
        actorId: input.actorId,
        operation: "MERGE_PROPOSAL",
        key: input.key,
        repositoryId: score.repositoryId,
        scoreId: score.id,
        candidate,
        artifacts,
        dataFormatVersion:
          typeof candidate === "object" &&
          candidate !== null &&
          "format" in candidate &&
          candidate.format === "converted-partial-v1"
            ? "converted-partial-v1"
            : "sheet-export-v1",
        expectedRepositoryOid: input.expectedRepositoryCommitOid,
        expectedRevisionId: input.expectedRevisionId,
        proposalId: proposal.id,
        preparedOid: proposal.proposalCommitOid,
        authorId: proposal.authorId,
        operationPayload: {
          proposalId: proposal.id,
          expectedProposalVersion: input.expectedProposalVersion,
          expectedRevisionId: input.expectedRevisionId,
        },
      },
      {
        authorize: async (transaction) => {
          await verifyTransactionActor(transaction, input.actorId);
          proof = await mergeAuthorization(
            transaction,
            score.repositoryId!,
            input.actorId,
          );
          const current = await transaction.editProposal.findUniqueOrThrow({
            where: { id: proposal.id },
          });
          const receipt = await transaction.mutationReceipt.findUnique({
            where: {
              actorId_operation_key: {
                actorId: input.actorId,
                operation: "MERGE_PROPOSAL",
                key: input.key,
              },
            },
          });
          if (receipt?.status === "COMPLETED") return;
          if (
            current.status !== "SUBMITTED" ||
            current.version !== input.expectedProposalVersion ||
            current.baseRevisionId !== input.expectedRevisionId ||
            current.baseRepositoryCommitOid !==
              input.expectedRepositoryCommitOid
          )
            throw new Error("CONFLICT");
        },
        apply: async (transaction, revision) => {
          if (!proof) throw new Error("INVALID_AUTHORIZATION");
          const changed = await transaction.editProposal.updateMany({
            where: {
              id: proposal.id,
              status: "SUBMITTED",
              version: input.expectedProposalVersion,
            },
            data: { status: "MERGED", version: { increment: 1 } },
          });
          if (changed.count !== 1) throw new Error("CONFLICT");
          const record = await transaction.mergeRecord.create({
            data: {
              proposalId: proposal.id,
              revisionId: revision.id,
              actorId: input.actorId,
              ...proof,
            },
          });
          if (proposal.authorId !== input.actorId) {
            await transaction.trustEvent.create({
              data: {
                userId: proposal.authorId,
                actorId: input.actorId,
                type: "ACCEPTED",
                sourceId: proposal.id,
                value: 1,
                reason: proposal.summary,
              },
            });
            await incrementTrustInput(transaction, proposal.authorId);
          }
          return { mergeRecordId: record.id };
        },
      },
      afterStage,
    );
  } catch (error_) {
    const error =
      typeof error_ === "object" &&
      error_ !== null &&
      "code" in error_ &&
      error_.code === "P2034"
        ? new Error("CONFLICT")
        : error_;
    if (error instanceof Error && error.message === "CONFLICT")
      await database.editProposal.updateMany({
        where: {
          id: proposal.id,
          status: "SUBMITTED",
          version: input.expectedProposalVersion,
        },
        data: { status: "CONFLICTED", version: { increment: 1 } },
      });
    throw error;
  }
}
