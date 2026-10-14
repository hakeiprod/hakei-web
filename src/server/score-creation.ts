import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { z } from "zod";
import { importCandidateSchema } from "@/s-core/models/import/contracts";
import type { RevisionArtifacts } from "./revision-validation";
import { repositoryAccess } from "./authorization";
import { claimMutation } from "./idempotency";
import { acceptScoreChange } from "./git-acceptance";
import { GitStore } from "./git-store";
export async function createScore(
  database: PrismaClient,
  git: GitStore,
  input: {
    actorId: string;
    repositoryId: string;
    candidate: unknown;
    key: string;
    artifacts?: RevisionArtifacts;
  },
) {
  const candidate = z.json().parse(input.candidate);
  importCandidateSchema.parse(candidate);
  const operationPayload = input.artifacts
    ? { importArtifacts: input.artifacts }
    : null;
  const receipt = await database.$transaction(
    async (transaction) => {
      const access = await repositoryAccess(
        transaction,
        input.repositoryId,
        input.actorId,
      );
      if (!access.canEdit) throw new Error("FORBIDDEN");
      const existing = await transaction.mutationReceipt.findUnique({
        where: {
          actorId_operation_key: {
            actorId: input.actorId,
            operation: "CREATE_SCORE",
            key: input.key,
          },
        },
      });
      const allocation = existing?.scoreId
        ? null
        : await transaction.$queryRaw<
            { id: number }[]
          >`SELECT nextval(pg_get_serial_sequence('"Score"', 'id'))::integer AS id`;
      const reserved = existing?.scoreId ?? allocation![0].id;
      return claimMutation(transaction, {
        actorId: input.actorId,
        operation: "CREATE_SCORE",
        key: input.key,
        repositoryId: input.repositoryId,
        scoreId: reserved,
        expectedRepositoryOid: access.repository.acceptedCommitOid ?? undefined,
        payload: {
          candidate,
          scoreId: null,
          expectedRepositoryOid: null,
          operationPayload,
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
  if (!receipt.scoreId) throw new Error("INVALID_OPERATION");
  return acceptScoreChange(
    database,
    git,
    {
      actorId: input.actorId,
      operation: "CREATE_SCORE",
      key: input.key,
      repositoryId: input.repositoryId,
      scoreId: receipt.scoreId,
      candidate,
      expectedRepositoryOid: receipt.expectedRepositoryOid ?? undefined,
      createScore: true,
      artifacts: input.artifacts,
      operationPayload: operationPayload ?? undefined,
      dataFormatVersion:
        "format" in (candidate as object)
          ? "converted-partial-v1"
          : "sheet-export-v1",
    },
    {
      authorize: async (transaction) => {
        const access = await repositoryAccess(
          transaction,
          input.repositoryId,
          input.actorId,
        );
        if (!access.canEdit) throw new Error("FORBIDDEN");
      },
    },
  );
}
