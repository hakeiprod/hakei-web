import { expect, test } from "vitest";
import { evaluateAssertion, documentRecords } from "./evaluate";
import { aggregateResults } from "./results";
import { Document, Page, Glyph } from "../document";
import type { FixtureDefinition, Assertion } from "./manifest";
const definition = {
  id: "head",
  expectedOutcome: "render",
  requiredStages: ["document", "svg", "visual"],
  assertions: [],
  visualChecklist: [{ id: "shape", expected: "visible" }],
} as unknown as FixtureDefinition;
const assertion: Assertion = {
  id: "head-count",
  stage: "document",
  kind: "count",
  selector: { glyphName: "noteheadBlack" },
  expected: 1,
};
test("detects missing and wrong symbols rather than accepting any document", () => {
  const document_ = new Document([
    new Page(20, 10, [
      new Glyph(
        0xe0_a4,
        { x: 2, y: 3 },
        { x: 2, y: 2, width: 1, height: 1 },
        1,
        { glyphName: "noteheadBlack" },
      ),
    ]),
  ]);
  expect(
    evaluateAssertion("head", assertion, documentRecords(document_)).status,
  ).toBe("pass");
  expect(evaluateAssertion("head", assertion, []).status).toBe("fail");
  expect(
    evaluateAssertion(
      "head",
      { ...assertion, selector: { glyphName: "noteheadHalf" } },
      documentRecords(document_),
    ).status,
  ).toBe("fail");
  expect(
    evaluateAssertion(
      "head",
      { ...assertion, kind: "absent", expected: 0 },
      documentRecords(document_),
    ).status,
  ).toBe("fail");
});
test("does not aggregate pending, skipped or missing required conditions as pass", () => {
  const f = { ...definition, assertions: [assertion] };
  expect(aggregateResults(f, [evaluateAssertion("head", assertion, [])])).toBe(
    "fail",
  );
  expect(
    aggregateResults(f, [
      evaluateAssertion("head", assertion, [{ glyphName: "noteheadBlack" }]),
    ]),
  ).toBe("pending");
  const reject = {
    ...f,
    expectedOutcome: "reject",
    requiredStages: ["persisted"],
    rejectionStage: "persisted",
    assertions: [
      {
        ...assertion,
        stage: "persisted",
        kind: "value",
        selector: { path: "error" },
        expected: "INVALID",
      },
    ],
    visualChecklist: [],
  } as FixtureDefinition;
  expect(
    aggregateResults(reject, [
      evaluateAssertion("head", reject.assertions[0], [], { error: "INVALID" }),
    ]),
  ).toBe("pass");
});

test("invalidates older implementation results and prefers latest failure", async () => {
  const { selectResults } = await import("./results");
  const identity = {
    sourceHash: "a".repeat(64),
    expectationHash: "b".repeat(64),
    rendererRevision: "c".repeat(64),
    layout: null,
  };
  const result = evaluateAssertion("head", assertion, [
    { glyphName: "noteheadBlack" },
  ]);
  const run = {
    ...identity,
    runId: "one",
    fixtureId: "head",
    executedAt: "2026-10-20T00:00:00.000Z",
    results: [result],
  };
  const f = { ...definition, assertions: [assertion] };
  expect(
    selectResults(f, [run], {
      ...identity,
      rendererRevision: "d".repeat(64),
    })[0].status,
  ).toBe("pending");
  expect(
    selectResults(
      f,
      [
        run,
        {
          ...run,
          runId: "two",
          executedAt: "2026-10-20T00:01:00.000Z",
          results: [{ ...result, status: "fail" }],
        },
      ],
      identity,
    )[0].status,
  ).toBe("fail");
});
