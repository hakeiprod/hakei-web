/* Serialized JSON transport intentionally drops undefined fields. */
/* eslint-disable unicorn/prefer-structured-clone */
import { fixtureTimeline } from "./timeline";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "vitest";
import { fixtureManifestSchema } from "./manifest";
import { convertScore } from "../import/convert";
import { prepareFixture } from "./prepare";
import {
  documentRecords,
  matches,
  evaluateAssertion,
  type DrawingRecord,
} from "./evaluate";
import { pendingResults } from "./results";
import { svgRecords } from "../browser/evaluate-fixture-svg";
import "../document/extensions/to-svg";
import { Score as SheetScore } from "../sheet";
import {
  createRun,
  readFixture,
  rendererRevision,
  atomicReport,
} from "../../../../scripts/lib/notation-report";
export async function registerFixtureSuite(suite: "notation" | "tab-drum") {
  const manifest = fixtureManifestSchema.parse(
    JSON.parse(
      await readFile(`src/s-core/fixtures/${suite}/manifest.json`, "utf8"),
    ),
  );
  const revision = process.env.NOTATION_REPORT_DIR
    ? await rendererRevision()
    : "";
  for (const fixture of manifest.fixtures) {
    test(fixture.id, async () => {
      const bytes = await readFixture(fixture.source.path);
      let results = pendingResults(fixture);
      let cleanup: (() => void) | undefined;
      try {
        if (
          fixture.expectedOutcome === "reject" &&
          fixture.rejectionStage === "persisted"
        )
          return;
        let conversion;
        try {
          conversion = await convertScore({
            bytes,
            sourceName: fixture.source.path,
            options: { mode: "PRESERVE" },
          });
        } catch (error) {
          if (fixture.expectedOutcome !== "reject") throw error;
          const data = {
            error: error instanceof Error ? error.message : String(error),
          };
          results = results.map((result) =>
            result.stage === "import"
              ? evaluateAssertion(
                  fixture.id,
                  fixture.assertions.find((a) => a.id === result.assertionId)!,
                  [],
                  data,
                )
              : result,
          );
          expect(
            results
              .filter((r) => r.stage === "import")
              .every((r) => r.status === "pass"),
          ).toBe(true);
          return;
        }
        if (fixture.expectedOutcome === "reject")
          throw new Error("Expected input rejection");
        if (fixture.expectedOutcome === "partial") {
          expect("format" in conversion.candidate).toBe(true);
          const data = {
            candidate: conversion.candidate,
            roundtrip: JSON.parse(JSON.stringify(conversion.candidate)),
            issues: conversion.issues,
            validation: conversion.validation,
          };
          results = results.map((result) => {
            const assertion = fixture.assertions.find(
              (a) => a.id === result.assertionId,
            );
            return assertion &&
              ["import", "roundtrip"].includes(assertion.stage)
              ? evaluateAssertion(fixture.id, assertion, [], data)
              : result;
          });
          for (const result of results.filter((r) =>
            ["import", "roundtrip"].includes(r.stage),
          ))
            expect(result.status, result.message).toBe("pass");
          return;
        }
        const prepared = prepareFixture(conversion.candidate, fixture);
        cleanup = () => prepared.controller.unmount();
        const record = documentRecords(prepared.document);
        const svgs = prepared.document.pages.map((_, pageIndex) =>
          prepared.document.toSVG({ pageIndex }),
        );
        const svg = svgRecords(svgs);
        const roundtrip = SheetScore.import(
          JSON.parse(JSON.stringify(prepared.score.export())),
        ).export();
        const timeline =
          conversion.canPractice && !("format" in conversion.candidate)
            ? fixtureTimeline(conversion.candidate)
            : null;
        const data = {
          timeline,
          candidate: conversion.candidate,
          issues: conversion.issues,
          validation: conversion.validation,
          roundtrip,
        };
        results = results.map((result) => {
          const assertion = fixture.assertions.find(
            (a) => a.id === result.assertionId,
          );
          if (
            !assertion ||
            !["document", "svg", "import", "roundtrip"].includes(result.stage)
          )
            return result;
          return evaluateAssertion(
            fixture.id,
            assertion,
            result.stage === "svg" ? svg : record,
            data,
          );
        });
        for (const result of results.filter((r) =>
          ["document", "svg", "import", "roundtrip"].includes(r.stage),
        ))
          expect(
            result.status,
            `${fixture.id}/${result.assertionId}: ${result.message}`,
          ).toBe("pass");
        for (const a of fixture.assertions.filter(
          (a) =>
            ["document", "svg"].includes(a.stage) &&
            ["relativePosition", "staffGap", "tieEndpoints"].includes(a.kind),
        )) {
          const records = a.stage === "svg" ? svg : record;
          let mutated: DrawingRecord[];
          if (a.kind === "staffGap") {
            const n = records.find((r) => matches(r, a.selector))!;
            mutated = [
              ...records,
              {
                role: "staff-line",
                source: n.source,
                pageIndex: n.pageIndex,
                start: { x: n.bounds!.x, y: n.y! },
                end: { x: n.bounds!.x + n.bounds!.width, y: n.y! },
              },
            ];
          } else
            mutated = records.map((r) =>
              matches(r, a.selector)
                ? {
                    ...r,
                    y: (r.y ?? 0) + 2,
                    endNote: { trackId: 999, noteId: 999 },
                  }
                : r,
            );
          expect(
            evaluateAssertion(fixture.id, a, mutated).status,
            `counterexample ${a.id}`,
          ).toBe("fail");
        }
        // Every asserted symbol count/absence has a destructive counterexample on a copy.
        for (const assertion of fixture.assertions.filter(
          (a) =>
            ["count", "absent"].includes(a.kind) &&
            ["document", "svg"].includes(a.stage),
        )) {
          const records = assertion.stage === "svg" ? svg : record;
          const mutated =
            assertion.kind === "absent" || assertion.expected === 0
              ? [...records, { ...assertion.selector }]
              : records.filter(
                  (record) => !matches(record, assertion.selector),
                );
          if (
            typeof assertion.expected === "number" &&
            assertion.expected > 0 &&
            assertion.selector.source?.noteId !== undefined
          ) {
            for (const replacement of [
              { tabValue: "999" },
              { string: 99 },
              { glyphName: "wrongNotehead" },
            ]) {
              if (
                !Object.keys(replacement).some(
                  (key) => key in assertion.selector,
                )
              )
                continue;
              const wrong = records.map((record) =>
                matches(record, assertion.selector)
                  ? { ...record, ...replacement }
                  : record,
              );
              expect(
                evaluateAssertion(fixture.id, assertion, wrong).status,
                `wrong symbol ${assertion.id}`,
              ).toBe("fail");
            }
          }
          expect(
            evaluateAssertion(fixture.id, assertion, mutated as DrawingRecord[])
              .status,
            `counterexample ${assertion.id}`,
          ).toBe("fail");
        }
      } catch (error) {
        results = results.map((r) =>
          r.status === "pending" && !["visual", "persisted"].includes(r.stage)
            ? {
                ...r,
                status: "error",
                message: error instanceof Error ? error.message : String(error),
              }
            : r,
        );
        throw error;
      } finally {
        cleanup?.();
        if (process.env.NOTATION_REPORT_DIR)
          await atomicReport(
            path.join(
              process.env.NOTATION_REPORT_DIR,
              `${encodeURIComponent(fixture.id)}.json`,
            ),
            createRun(fixture, bytes, revision, results),
          );
      }
    });
  }
}
