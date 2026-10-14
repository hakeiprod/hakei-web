import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import {
  conversionIssueSchema,
  importMetadataSchema,
  revisionValidationSchema,
  type ImportMetadata,
  type ConversionIssue,
} from "@/s-core/models/import/contracts";
import { validateCandidate } from "@/s-core/models/import/diagnostics";
import { GitStore } from "./git-store";
export interface RevisionArtifacts {
  metadata: ImportMetadata | null;
  issues: ConversionIssue[];
  validation: z.infer<typeof revisionValidationSchema>;
  acknowledgedIssueIds?: string[];
}
export function revisionArtifacts(
  candidate: unknown,
  metadata: ImportMetadata | null = null,
  issues: ConversionIssue[] = [],
): RevisionArtifacts {
  const result = validateCandidate(candidate, issues);
  return {
    metadata: metadata === null ? null : importMetadataSchema.parse(metadata),
    issues: result.issues,
    validation: result.validation,
  };
}
export async function readRevisionArtifacts(
  git: GitStore,
  key: string,
  oid: string,
  scoreId: number,
): Promise<RevisionArtifacts | undefined> {
  const base = `scores/${scoreId}`;
  if (!(await git.hasScoreFile(key, oid, `${base}/settings.json`)))
    return undefined;
  const settings = z
    .object({
      metadata: importMetadataSchema.nullable(),
      acknowledgedIssueIds: z.array(z.string()),
    })
    .strict()
    .parse(await git.readJson(key, oid, `${base}/settings.json`));
  return {
    metadata: settings.metadata,
    acknowledgedIssueIds: settings.acknowledgedIssueIds,
    issues: z
      .array(conversionIssueSchema)
      .parse(await git.readJson(key, oid, `${base}/diagnostics.json`)),
    validation: revisionValidationSchema.parse(
      await git.readJson(key, oid, `${base}/validation.json`),
    ),
  };
}
export function artifactFiles(scoreId: number, artifacts: RevisionArtifacts) {
  const base = `scores/${scoreId}`;
  return {
    [`${base}/settings.json`]: {
      metadata: artifacts.metadata,
      acknowledgedIssueIds: artifacts.acknowledgedIssueIds ?? [],
    },
    [`${base}/diagnostics.json`]: artifacts.issues,
    [`${base}/validation.json`]: artifacts.validation,
  };
}
export async function projectRevisionArtifacts(
  transaction: Prisma.TransactionClient,
  revisionId: string,
  artifacts: RevisionArtifacts,
  acknowledgedAt: Date,
) {
  if (artifacts.metadata) {
    const metadata = artifacts.metadata;
    await transaction.importMetadata.create({
      data: {
        revisionId,
        format: metadata.format,
        formatVersion: metadata.formatVersion,
        converterVersion: metadata.converterVersion,
        mode: metadata.options.mode,
        grid:
          metadata.options.mode === "QUANTIZE" ? metadata.options.grid : null,
        sourceName: metadata.sourceName,
        warningAcknowledgedAt: artifacts.acknowledgedIssueIds?.length
          ? acknowledgedAt
          : null,
      },
    });
  }
  await transaction.revisionValidation.create({
    data: { revisionId, ...artifacts.validation },
  });
  if (artifacts.issues.length > 0)
    await transaction.conversionIssue.createMany({
      data: artifacts.issues.map(({ id, ...issue }) => ({
        revisionId,
        issueId: id,
        ...issue,
      })),
    });
}
