import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import { promotePartial } from "@/s-core/models/import/promote-partial";
import {
  artifactFiles,
  revisionArtifacts,
  readRevisionArtifacts,
  type RevisionArtifacts,
} from "./revision-validation";
import { repositoryAccess } from "./authorization";
import { claimMutation, finishMutation } from "./idempotency";
import { GitStore } from "./git-store";
import { leaseOperation, releaseOperation } from "./git-operation";
import { payloadHash } from "./contracts";
import { mergeAuthorization } from "./merge-authorization";
import { incrementTrustInput } from "./trust";

async function editableScore(
  database: Prisma.TransactionClient,
  scoreId: number,
  actorId: string,
) {
  const score = await database.score.findUniqueOrThrow({
    where: { id: scoreId },
  });
  if (!score.repositoryId || !score.currentRevisionId || score.archivedAt)
    throw new Error("NOT_FOUND");
  const access = await repositoryAccess(database, score.repositoryId, actorId);
  if (!access.canEdit) throw new Error("FORBIDDEN");
  if (!access.repository.acceptedCommitOid) throw new Error("CONFLICT");
  return { score, access };
}
export async function saveDraft(
  database: PrismaClient,
  git: GitStore,
  input: {
    actorId: string;
    scoreId: number;
    baseRevisionId: string;
    candidate: unknown;
    summary: string;
    key: string;
    proposalId?: string;
    expectedVersion?: number;
    artifacts?: RevisionArtifacts;
  },
) {
  const promoted = promotePartial(input.candidate);
  const candidate = z.json().parse(promoted.candidate);
  const summary = z.string().trim().min(1).max(2000).parse(input.summary);
  const operation = input.proposalId ? "UPDATE_DRAFT" : "CREATE_DRAFT";
  const preparation = await database.$transaction(async (transaction) => {
    const { score, access } = await editableScore(
      transaction,
      input.scoreId,
      input.actorId,
    );
    const proposal = input.proposalId
      ? await transaction.editProposal.findUniqueOrThrow({
          where: { id: input.proposalId },
        })
      : null;
    if (
      proposal &&
      (proposal.authorId !== input.actorId || proposal.scoreId !== score.id)
    )
      throw new Error("FORBIDDEN");
    const receipt = await claimMutation(transaction, {
      actorId: input.actorId,
      operation,
      key: input.key,
      repositoryId: score.repositoryId!,
      scoreId: score.id,
      proposalId: proposal?.id ?? randomUUID(),
      expectedRepositoryOid:
        proposal?.baseRepositoryCommitOid ??
        access.repository.acceptedCommitOid!,
      expectedRevisionId: input.baseRevisionId,
      payload: {
        scoreId: score.id,
        baseRevisionId: input.baseRevisionId,
        candidate,
        summary,
        proposalId: input.proposalId ?? null,
        expectedVersion: input.expectedVersion ?? null,
        ...(input.artifacts ? { importArtifacts: input.artifacts } : {}),
      },
    });
    return { receipt, proposal, access };
  });
  const { receipt, proposal, access } = preparation;
  const baseRevision = await database.scoreRevision.findUniqueOrThrow({
    where: { id: input.baseRevisionId },
  });
  if (
    baseRevision.scoreId !== input.scoreId ||
    baseRevision.repositoryId !== access.repository.id
  )
    throw new Error("FORBIDDEN");
  const sourceArtifacts =
    input.artifacts ??
    (await readRevisionArtifacts(
      git,
      access.repository.gitStorageKey,
      baseRevision.commitOid,
      input.scoreId,
    ));
  const artifacts = revisionArtifacts(
    candidate,
    sourceArtifacts?.metadata ?? null,
    [
      ...(sourceArtifacts?.issues ?? []),
      ...promoted.issues.filter(
        (issue) =>
          !sourceArtifacts?.issues.some((original) => original.id === issue.id),
      ),
    ],
  );
  artifacts.acknowledgedIssueIds = sourceArtifacts?.acknowledgedIssueIds ?? [];
  if (receipt.status === "COMPLETED") return receipt.result;
  if (
    proposal &&
    (proposal.status !== "DRAFT" ||
      proposal.version !== input.expectedVersion ||
      proposal.baseRevisionId !== input.baseRevisionId)
  )
    throw new Error("CONFLICT");
  const version = proposal ? proposal.version + 1 : 0;
  const lease = await leaseOperation(database, receipt.id);
  try {
    const path = `scores/${input.scoreId}/score.json`;
    const operationReference = `refs/operations/${receipt.id}`;
    let oid = await git.readRef(
      access.repository.gitStorageKey,
      operationReference,
    );
    if (!oid) {
      oid = await git.commit(
        access.repository.gitStorageKey,
        receipt.expectedRepositoryOid!,
        { [path]: candidate, ...artifactFiles(input.scoreId, artifacts) },
        summary,
      );
      await git.updateRef(
        access.repository.gitStorageKey,
        operationReference,
        oid,
      );
    }
    if (
      payloadHash(
        await git.readJson(access.repository.gitStorageKey, oid, path),
      ) !== payloadHash(candidate)
    )
      throw new Error("CONFLICT");
    const preparedArtifacts = await readRevisionArtifacts(
      git,
      access.repository.gitStorageKey,
      oid,
      input.scoreId,
    );
    if (
      !preparedArtifacts ||
      payloadHash(preparedArtifacts) !== payloadHash(artifacts)
    )
      throw new Error("CONFLICT");
    const proposalReference = `refs/proposals/${receipt.proposalId}-v${version}`;
    const existing = await git.readRef(
      access.repository.gitStorageKey,
      proposalReference,
    );
    if (existing && existing !== oid) throw new Error("CONFLICT");
    if (!existing)
      await git.updateRef(
        access.repository.gitStorageKey,
        proposalReference,
        oid,
      );
    await database.mutationReceipt.update({
      where: { id: receipt.id },
      data: {
        preparedCommitOid: oid,
        preparedRef: operationReference,
        stage: "OBJECT_PREPARED",
      },
    });
    return await database.$transaction(
      async (transaction) => {
        const current = await editableScore(
          transaction,
          input.scoreId,
          input.actorId,
        );
        if (
          current.score.currentRevisionId !== input.baseRevisionId ||
          current.access.repository.acceptedCommitOid !==
            receipt.expectedRepositoryOid
        )
          throw new Error("CONFLICT");
        const lock = await transaction.mutationReceipt.findUniqueOrThrow({
          where: { id: receipt.id },
        });
        if (
          lock.leaseOwner !== lease ||
          !lock.leaseUntil ||
          lock.leaseUntil.getTime() <= Date.now()
        )
          throw new Error("IN_PROGRESS");
        if (proposal) {
          const changed = await transaction.editProposal.updateMany({
            where: {
              id: proposal.id,
              authorId: input.actorId,
              status: "DRAFT",
              version: input.expectedVersion,
            },
            data: {
              proposalCommitOid: oid,
              proposalRef: proposalReference,
              summary,
              version: { increment: 1 },
            },
          });
          if (changed.count !== 1) throw new Error("CONFLICT");
        } else
          await transaction.editProposal.create({
            data: {
              id: receipt.proposalId!,
              scoreId: input.scoreId,
              baseRevisionId: input.baseRevisionId,
              baseRepositoryCommitOid: receipt.expectedRepositoryOid!,
              proposalCommitOid: oid,
              proposalRef: proposalReference,
              authorId: input.actorId,
              summary,
            },
          });
        const result = { proposalId: receipt.proposalId!, version };
        await finishMutation(transaction, receipt.id, result);
        return result;
      },
      { isolationLevel: "Serializable" },
    );
  } finally {
    await releaseOperation(database, receipt.id, lease);
  }
}
export async function submitProposal(
  database: PrismaClient,
  input: { actorId: string; proposalId: string; expectedVersion: number },
) {
  return database.$transaction(
    async (transaction) => {
      const proposal = await transaction.editProposal.findUniqueOrThrow({
        where: { id: input.proposalId },
      });
      const { score, access } = await editableScore(
        transaction,
        proposal.scoreId,
        input.actorId,
      );
      if (proposal.authorId !== input.actorId) throw new Error("FORBIDDEN");
      const receipt = await claimMutation(transaction, {
        actorId: input.actorId,
        operation: "SUBMIT_PROPOSAL",
        key: `submit-${proposal.id}-${input.expectedVersion}`,
        repositoryId: score.repositoryId!,
        proposalId: proposal.id,
        payload: {
          proposalId: proposal.id,
          expectedVersion: input.expectedVersion,
        },
      });
      if (receipt.status === "COMPLETED")
        return z
          .object({ proposalId: z.string(), version: z.int() })
          .parse(receipt.result);
      if (
        proposal.status !== "DRAFT" ||
        proposal.version !== input.expectedVersion ||
        score.currentRevisionId !== proposal.baseRevisionId ||
        access.repository.acceptedCommitOid !== proposal.baseRepositoryCommitOid
      )
        throw new Error("CONFLICT");
      const changed = await transaction.editProposal.updateMany({
        where: {
          id: proposal.id,
          status: "DRAFT",
          version: input.expectedVersion,
        },
        data: { status: "SUBMITTED", version: { increment: 1 } },
      });
      if (changed.count !== 1) throw new Error("CONFLICT");
      await transaction.auditEvent.create({
        data: {
          actorId: input.actorId,
          entityType: "EditProposal",
          entityId: proposal.id,
          action: "SUBMIT_PROPOSAL",
          reason: proposal.summary,
        },
      });
      const result = {
        proposalId: proposal.id,
        version: input.expectedVersion + 1,
      };
      await finishMutation(transaction, receipt.id, result);
      return result;
    },
    { isolationLevel: "Serializable" },
  );
}
export async function closeProposal(
  database: PrismaClient,
  input: {
    actorId: string;
    proposalId: string;
    expectedVersion: number;
    decision: "REJECTED" | "WITHDRAWN";
    reason: string;
    key: string;
  },
) {
  if (!input.reason.trim()) throw new Error("REASON_REQUIRED");
  return database.$transaction(
    async (transaction) => {
      const proposal = await transaction.editProposal.findUniqueOrThrow({
        where: { id: input.proposalId },
      });
      const score = await transaction.score.findUniqueOrThrow({
        where: { id: proposal.scoreId },
      });
      if (!score.repositoryId) throw new Error("NOT_FOUND");
      await repositoryAccess(transaction, score.repositoryId, input.actorId);
      if (input.decision === "WITHDRAWN") {
        if (proposal.authorId !== input.actorId) throw new Error("FORBIDDEN");
      } else
        await mergeAuthorization(
          transaction,
          score.repositoryId,
          input.actorId,
        );
      const receipt = await claimMutation(transaction, {
        actorId: input.actorId,
        operation: input.decision,
        key: input.key,
        repositoryId: score.repositoryId,
        proposalId: proposal.id,
        payload: {
          proposalId: proposal.id,
          expectedVersion: input.expectedVersion,
          reason: input.reason,
        },
      });
      if (receipt.status === "COMPLETED") return receipt.result;
      if (
        proposal.status === "MERGED" ||
        proposal.status === "WITHDRAWN" ||
        proposal.version !== input.expectedVersion ||
        (input.decision === "REJECTED" && proposal.status !== "SUBMITTED")
      )
        throw new Error("CONFLICT");
      const changed = await transaction.editProposal.updateMany({
        where: {
          id: proposal.id,
          version: input.expectedVersion,
          status: proposal.status,
        },
        data: { status: input.decision, version: { increment: 1 } },
      });
      if (changed.count !== 1) throw new Error("CONFLICT");
      if (
        input.decision === "REJECTED" &&
        proposal.authorId !== input.actorId
      ) {
        await transaction.trustEvent.create({
          data: {
            userId: proposal.authorId,
            actorId: input.actorId,
            type: "REJECTED",
            sourceId: proposal.id,
            value: 1,
            reason: input.reason.trim(),
          },
        });
        await incrementTrustInput(transaction, proposal.authorId);
      }
      await transaction.auditEvent.create({
        data: {
          actorId: input.actorId,
          entityType: "EditProposal",
          entityId: proposal.id,
          action: input.decision,
          reason: input.reason.trim(),
        },
      });
      const result = {
        proposalId: proposal.id,
        status: input.decision,
        version: input.expectedVersion + 1,
      };
      await finishMutation(transaction, receipt.id, result);
      return result;
    },
    { isolationLevel: "Serializable" },
  );
}
