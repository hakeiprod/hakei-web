import "server-only";
import type {
  Prisma,
  PrismaClient,
  ScoreRevision,
} from "@/generated/prisma/client";
import { payloadHash } from "./contracts";
import {
  artifactFiles,
  revisionArtifacts,
  projectRevisionArtifacts,
  readRevisionArtifacts,
  type RevisionArtifacts,
} from "./revision-validation";
import { claimMutation } from "./idempotency";
import { leaseOperation, releaseOperation } from "./git-operation";
import { GitStore } from "./git-store";
import { publishGitOperation } from "./git-publication";
export type AcceptanceStage =
  | "REF_PREPARED"
  | "OBJECT_RECORDED"
  | "DB_APPLIED"
  | "REF_PUBLISHED";
type InitialInput = {
  actorId: string;
  operation: "MIGRATE_LEGACY" | "ASSIGN_LEGACY";
  key: string;
  repositoryId: string;
  scoreId: number;
  candidate: unknown;
  expectedRepositoryOid?: string;
};
export type ScoreChangeInput = Omit<InitialInput, "operation"> & {
  operation:
    | "MIGRATE_LEGACY"
    | "ASSIGN_LEGACY"
    | "CREATE_SCORE"
    | "MERGE_PROPOSAL";
  expectedRevisionId?: string;
  proposalId?: string;
  preparedOid?: string;
  artifacts?: RevisionArtifacts;
  dataFormatVersion?: string;
  authorId?: string;
  createScore?: boolean;
  operationPayload?: unknown;
};
export type AcceptanceHooks = {
  authorize: (transaction: Prisma.TransactionClient) => Promise<void>;
  apply?: (
    transaction: Prisma.TransactionClient,
    revision: ScoreRevision,
  ) => Promise<Record<string, Prisma.InputJsonValue>>;
};
export async function acceptInitialScore(
  database: PrismaClient,
  git: GitStore,
  input: InitialInput,
  afterStage?: (stage: AcceptanceStage) => void | Promise<void>,
) {
  return acceptScoreChange(database, git, input, undefined, afterStage);
}
/** All acceptance kinds share object preparation, short DB adoption and ref projection. */
export async function acceptScoreChange(
  database: PrismaClient,
  git: GitStore,
  input: ScoreChangeInput,
  hooks?: AcceptanceHooks,
  afterStage?: (stage: AcceptanceStage) => void | Promise<void>,
) {
  let artifacts: RevisionArtifacts;
  try {
    artifacts = revisionArtifacts(
      input.candidate,
      input.artifacts?.metadata ?? null,
      input.artifacts?.issues ?? [],
    );
    artifacts.acknowledgedIssueIds =
      input.artifacts?.acknowledgedIssueIds ?? [];
  } catch (error) {
    if (!["MIGRATE_LEGACY", "ASSIGN_LEGACY"].includes(input.operation))
      throw error;
    artifacts = {
      metadata: null,
      issues: [
        {
          id: "legacy-invalid",
          code: "INVALID_STORED_SCORE",
          severity: "BLOCKING",
          status: "UNRESOLVED",
          message: "既存の楽譜形式を確認して修正してください。",
        },
      ],
      validation: {
        validatorVersion: "score-import-validation-v1",
        canPractice: false,
        canGame: false,
        unresolvedIssueIds: ["legacy-invalid"],
      },
    };
  }
  const actor = await database.user.findUniqueOrThrow({
    where: { id: input.actorId },
  });
  if (hooks)
    await database.$transaction((transaction) => hooks.authorize(transaction), {
      isolationLevel: "Serializable",
    });
  else if (
    actor.serviceRole !== "OPERATOR" ||
    !["MIGRATE_LEGACY", "ASSIGN_LEGACY"].includes(input.operation)
  )
    throw new Error("FORBIDDEN");
  const receipt = await claimMutation(database, {
    ...input,
    payload: {
      candidate: input.candidate,
      scoreId: input.createScore ? null : input.scoreId,
      expectedRepositoryOid: input.createScore
        ? null
        : (input.expectedRepositoryOid ?? null),
      operationPayload: input.operationPayload ?? null,
    },
  });
  if (receipt.status === "COMPLETED") return receipt.result;
  const owner = await leaseOperation(database, receipt.id);
  try {
    const repository = await database.scoreRepository.findUniqueOrThrow({
      where: { id: input.repositoryId },
    });
    const reference = `refs/operations/${receipt.id}`;
    const path = `scores/${input.scoreId}/score.json`;
    await git.initialize(repository.gitStorageKey);
    let oid = await git.readRef(repository.gitStorageKey, reference);
    if (!oid) {
      oid =
        input.preparedOid ??
        (await git.commit(
          repository.gitStorageKey,
          input.expectedRepositoryOid,
          {
            [path]: input.candidate,
            ...artifactFiles(input.scoreId, artifacts),
          },
          input.operation,
        ));
      await git.updateRef(repository.gitStorageKey, reference, oid);
    }
    await afterStage?.("REF_PREPARED");
    const saved = await git.readJson(repository.gitStorageKey, oid, path);
    if (payloadHash(saved) !== payloadHash(input.candidate))
      throw new Error("CONFLICT");
    const storedArtifacts = await readRevisionArtifacts(
      git,
      repository.gitStorageKey,
      oid,
      input.scoreId,
    );
    if (
      storedArtifacts &&
      payloadHash(storedArtifacts) !==
        payloadHash({
          ...artifacts,
          acknowledgedIssueIds: artifacts.acknowledgedIssueIds ?? [],
        })
    )
      throw new Error("CONFLICT");
    await database.mutationReceipt.update({
      where: { id: receipt.id },
      data: {
        preparedCommitOid: oid,
        preparedRef: reference,
        stage: "OBJECT_PREPARED",
      },
    });
    await afterStage?.("OBJECT_RECORDED");
    const result = await database.$transaction(
      async (transaction) => {
        const currentActor = await transaction.user.findUniqueOrThrow({
          where: { id: input.actorId },
        });
        if (hooks) await hooks.authorize(transaction);
        else if (currentActor.serviceRole !== "OPERATOR")
          throw new Error("FORBIDDEN");
        const current = await transaction.scoreRepository.findUniqueOrThrow({
          where: { id: input.repositoryId },
        });
        const currentReceipt =
          await transaction.mutationReceipt.findUniqueOrThrow({
            where: { id: receipt.id },
          });
        if (
          currentReceipt.leaseOwner !== owner ||
          !currentReceipt.leaseUntil ||
          currentReceipt.leaseUntil.getTime() <= Date.now()
        )
          throw new Error("IN_PROGRESS");
        if (current.acceptedCommitOid !== (input.expectedRepositoryOid ?? null))
          throw new Error("CONFLICT");
        if (current.syncState !== "READY") throw new Error("TEMPORARY_FAILURE");
        const score = input.createScore
          ? await transaction.score.create({ data: { id: input.scoreId } })
          : await transaction.score.findUniqueOrThrow({
              where: { id: input.scoreId },
            });
        if (
          input.expectedRevisionId &&
          score.currentRevisionId !== input.expectedRevisionId
        )
          throw new Error("CONFLICT");
        if (score.repositoryId && score.repositoryId !== current.id)
          throw new Error("CONFLICT");
        const previous = await transaction.scoreRevision.aggregate({
          where: { scoreId: score.id },
          _max: { number: true },
        });
        const revision = await transaction.scoreRevision.create({
          data: {
            scoreId: score.id,
            number: (previous._max.number ?? 0) + 1,
            repositoryId: current.id,
            commitOid: oid,
            path,
            dataHash: payloadHash(saved),
            dataFormatVersion: input.dataFormatVersion ?? "sheet-export-v1",
            authorId: input.authorId ?? input.actorId,
            proposalId: input.proposalId,
          },
        });
        await projectRevisionArtifacts(
          transaction,
          revision.id,
          artifacts,
          revision.createdAt,
        );
        const generation = current.acceptedGeneration + 1;
        const changed = await transaction.scoreRepository.updateMany({
          where: {
            id: current.id,
            acceptedCommitOid: current.acceptedCommitOid,
            acceptedGeneration: current.acceptedGeneration,
            syncState: "READY",
          },
          data: {
            acceptedCommitOid: oid,
            acceptedGeneration: generation,
            syncState: "PENDING_PUBLICATION",
          },
        });
        if (changed.count !== 1) throw new Error("CONFLICT");
        if (current.ownerId) {
          await transaction.score.update({
            where: { id: score.id },
            data: { repositoryId: current.id, currentRevisionId: revision.id },
          });
        }
        const extra = await hooks?.apply?.(transaction, revision);
        const result = {
          status: "APPLIED",
          scoreId: score.id,
          revisionId: revision.id,
          commitOid: oid,
          ...extra,
        };
        await transaction.mutationReceipt.update({
          where: { id: receipt.id },
          data: { stage: "DB_APPLIED", status: "COMPLETED", result },
        });
        await transaction.gitPublicationJob.create({
          data: {
            operationId: receipt.id,
            repositoryId: current.id,
            targetOid: oid,
            expectedOldOid: current.acceptedCommitOid,
            generation,
          },
        });
        return result;
      },
      { isolationLevel: "Serializable" },
    );
    await afterStage?.("DB_APPLIED");
    await releaseOperation(database, receipt.id, owner);
    try {
      await publishGitOperation(database, git, receipt.id);
    } catch {
      return result;
    } // Adoption is already durable; the worker completes projection.
    await afterStage?.("REF_PUBLISHED");
    return result;
  } finally {
    await releaseOperation(database, receipt.id, owner);
  }
}

/** Recover operator preparation from immutable Git only. Missing objects wait for resubmission. */
export async function recoverInitialPreparations(
  database: PrismaClient,
  git: GitStore,
) {
  const receipts = await database.mutationReceipt.findMany({
    where: {
      status: "PREPARING",
      operation: { in: ["MIGRATE_LEGACY", "ASSIGN_LEGACY"] },
    },
  });
  const results: { operationId: string; status: string }[] = [];
  for (const receipt of receipts) {
    try {
      if (!receipt.repositoryId) throw new Error("REPAIR_REQUIRED");
      const repository = await database.scoreRepository.findUniqueOrThrow({
        where: { id: receipt.repositoryId },
      });
      if (!receipt.scoreId) throw new Error("REPAIR_REQUIRED");
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
      await acceptInitialScore(database, git, {
        actorId: receipt.actorId,
        operation: receipt.operation as InitialInput["operation"],
        key: receipt.key,
        repositoryId: receipt.repositoryId,
        scoreId: receipt.scoreId,
        candidate,
        expectedRepositoryOid: receipt.expectedRepositoryOid ?? undefined,
      });
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
