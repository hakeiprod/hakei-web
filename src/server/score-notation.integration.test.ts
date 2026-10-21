import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "vitest";
import { fixtureManifestSchema } from "@/s-core/models/fixtures/manifest";
import { pendingResults } from "@/s-core/models/fixtures/results";
import {
  evaluateAssertion,
  documentRecords,
} from "@/s-core/models/fixtures/evaluate";
import { prepareFixture } from "@/s-core/models/fixtures/prepare";
import { convertScore } from "@/s-core/models/import/convert";
import { withCollaboration } from "./testing/collaboration";
import { signPreview } from "./import-preview-token";
import { saveImport } from "./score-import";
import { readScore } from "./score-reader";
import {
  createRun,
  atomicReport,
  rendererRevision,
  readFixture,
} from "../../scripts/lib/notation-report";
const manifest = fixtureManifestSchema.parse(
  JSON.parse(
    await readFile("src/s-core/fixtures/notation/manifest.json", "utf8"),
  ),
);
const secret = "notation-test-secret-at-least-32-characters";
const revision = process.env.NOTATION_REPORT_DIR
  ? await rendererRevision()
  : "";
for (const definition of manifest.fixtures.filter((f) =>
  f.requiredStages.includes("persisted"),
))
  test(`persisted ${definition.id}`, async () => {
    const bytes = await readFixture(definition.source.path);
    let results = pendingResults(definition).filter(
      (r) => r.stage === "persisted",
    );
    try {
      await withCollaboration(async (fixture) => {
        if (definition.expectedOutcome === "reject") {
          const candidate = JSON.parse(new TextDecoder().decode(bytes));
          const before = await fixture.database.score.findUniqueOrThrow({
            where: { id: fixture.scoreId },
          });
          const count = await fixture.database.scoreRevision.count({
            where: { scoreId: fixture.scoreId },
          });
          const metadata = {
            format: "SHEET_JSON" as const,
            formatVersion: "1",
            converterVersion: "score-import-v3",
            options: { mode: "PRESERVE" as const },
          };
          const payload = { candidate, issues: [], metadata };
          let rejected = false;
          try {
            await saveImport(
              fixture.database,
              fixture.git,
              fixture.ownerId,
              {
                ...payload,
                scoreId: fixture.scoreId,
                baseRevisionId: fixture.revisionId,
                repositoryId: fixture.repositoryId,
                previewToken: signPreview(fixture.ownerId, payload, secret),
                acknowledgedIssueIds: [],
                key: "notation-invalid",
              },
              secret,
            );
          } catch (error) {
            rejected = error instanceof Error && error.name === "ZodError";
          }
          const after = await fixture.database.score.findUniqueOrThrow({
            where: { id: fixture.scoreId },
          });
          const unchanged =
            before.currentRevisionId === after.currentRevisionId &&
            count ===
              (await fixture.database.scoreRevision.count({
                where: { scoreId: fixture.scoreId },
              }));
          const old = await readScore(
            fixture.database,
            fixture.git,
            fixture.scoreId,
            fixture.ownerId,
          );
          expect(old.revisionId).toBe(fixture.revisionId);
          results = definition.assertions.map((a) =>
            evaluateAssertion(definition.id, a, [], { rejected, unchanged }),
          );
        } else {
          const conversion = await convertScore({
            bytes,
            sourceName: definition.source.path,
            options: { mode: "PRESERVE" },
          });
          const payload = {
            candidate: conversion.candidate,
            issues: conversion.issues,
            metadata: conversion.metadata,
          };
          const input = {
            ...payload,
            repositoryId: fixture.repositoryId,
            previewToken: signPreview(fixture.ownerId, payload, secret),
            acknowledgedIssueIds: conversion.issues
              .filter(
                (index) =>
                  index.severity !== "INFO" && index.status === "UNRESOLVED",
              )
              .map((index) => index.id),
            key: "notation-create",
          };
          const saved = (await saveImport(
            fixture.database,
            fixture.git,
            fixture.ownerId,
            input,
            secret,
          )) as { scoreId: number };
          const loaded = await readScore(
            fixture.database,
            fixture.git,
            saved.scoreId,
            fixture.ownerId,
          );
          expect(loaded.data).toEqual(conversion.candidate);
          const { controller, document } = prepareFixture(
            loaded.data,
            definition,
          );
          try {
            for (const assertion of definition.assertions.filter(
              (a) => a.stage === "document",
            ))
              expect(
                evaluateAssertion(
                  definition.id,
                  assertion,
                  documentRecords(document),
                ).status,
                assertion.id,
              ).toBe("pass");
          } finally {
            controller.unmount();
          }
          results = definition.assertions
            .filter((a) => a.stage === "persisted")
            .map((a) =>
              evaluateAssertion(definition.id, a, [], {
                candidate: loaded.data,
              }),
            );
          // Exercise reimport through an existing score's proposal and merge path.
          const draft = (await saveImport(
            fixture.database,
            fixture.git,
            fixture.ownerId,
            {
              ...input,
              key: "notation-proposal",
              scoreId: saved.scoreId,
              baseRevisionId: loaded.revisionId,
            },
            secret,
          )) as { proposalId: string };
          const { mergeProposal } = await import("./merge-proposal");
          const proposal =
            await fixture.database.editProposal.findUniqueOrThrow({
              where: { id: draft.proposalId },
            });
          const repo = await fixture.database.scoreRepository.findUniqueOrThrow(
            { where: { id: fixture.repositoryId } },
          );
          await mergeProposal(fixture.database, fixture.git, {
            actorId: fixture.ownerId,
            proposalId: draft.proposalId,
            expectedProposalVersion: proposal.version,
            expectedRevisionId: loaded.revisionId,
            expectedRepositoryCommitOid: repo.acceptedCommitOid!,
            key: "notation-merge",
          });
          const merged = await readScore(
            fixture.database,
            fixture.git,
            saved.scoreId,
            fixture.ownerId,
          );
          expect(merged.data).toEqual(conversion.candidate);
        }
        for (const result of results)
          expect(result.status, result.message).toBe("pass");
      });
    } catch (error) {
      results = results.map((r) => ({
        ...r,
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      }));
      throw error;
    } finally {
      if (process.env.NOTATION_REPORT_DIR)
        await atomicReport(
          path.join(
            process.env.NOTATION_REPORT_DIR,
            `persisted-${encodeURIComponent(definition.id)}.json`,
          ),
          createRun(definition, bytes, revision, results),
        );
    }
  }, 30_000);
