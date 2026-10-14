import "server-only";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  importCandidateSchema,
  conversionIssueSchema,
  importMetadataSchema,
} from "@/s-core/models/import/contracts";
import { mutationKeySchema } from "./contracts";
import { verifyPreview } from "./import-preview-token";
import { revisionArtifacts } from "./revision-validation";
import { createScore } from "./score-creation";
import { saveDraft, submitProposal } from "./proposals";
import { GitStore } from "./git-store";
const inputSchema = z
  .object({
    repositoryId: z.string().min(1),
    scoreId: z.int().positive().optional(),
    baseRevisionId: z.string().optional(),
    candidate: importCandidateSchema,
    issues: z.array(conversionIssueSchema),
    metadata: importMetadataSchema,
    previewToken: z.string().max(4096),
    acknowledgedIssueIds: z.array(z.string()),
    key: mutationKeySchema,
  })
  .strict();
export async function saveImport(
  database: PrismaClient,
  git: GitStore,
  actorId: string,
  raw: unknown,
  secret = process.env.IMPORT_PREVIEW_SECRET,
) {
  const input = inputSchema.parse(raw);
  verifyPreview(input.previewToken, actorId, input, secret);
  const required = input.issues
    .filter(
      (issue) => issue.severity !== "INFO" && issue.status === "UNRESOLVED",
    )
    .map((issue) => issue.id);
  if (
    new Set(input.acknowledgedIssueIds).size !==
      input.acknowledgedIssueIds.length ||
    required.some((id) => !input.acknowledgedIssueIds.includes(id)) ||
    input.acknowledgedIssueIds.some((id) => !required.includes(id))
  )
    throw new Error("WARNING_ACKNOWLEDGEMENT_REQUIRED");
  const artifacts = revisionArtifacts(
    input.candidate,
    input.metadata,
    input.issues,
  );
  artifacts.acknowledgedIssueIds = [...input.acknowledgedIssueIds].toSorted();
  if (input.scoreId === undefined) {
    if (input.baseRevisionId !== undefined)
      throw new Error("INVALID_IMPORT_TARGET");
    return createScore(database, git, {
      actorId,
      repositoryId: input.repositoryId,
      candidate: input.candidate,
      key: input.key,
      artifacts,
    });
  }
  if (!input.baseRevisionId) throw new Error("INVALID_IMPORT_TARGET");
  const score = await database.score.findUniqueOrThrow({
    where: { id: input.scoreId },
  });
  if (score.repositoryId !== input.repositoryId) throw new Error("FORBIDDEN");
  const draft = (await saveDraft(database, git, {
    actorId,
    scoreId: input.scoreId,
    baseRevisionId: input.baseRevisionId,
    candidate: input.candidate,
    summary: `楽譜の取り込み: ${input.metadata.sourceName ?? "楽譜"}`,
    key: input.key,
    artifacts,
  })) as { proposalId: string; version: number };
  return submitProposal(database, {
    actorId,
    proposalId: draft.proposalId,
    expectedVersion: draft.version,
  });
}
