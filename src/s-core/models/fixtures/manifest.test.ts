import { expect, test } from "vitest";
import { fixtureManifestSchema } from "./manifest";
const valid = () => ({
  version: 1,
  fixtures: [
    {
      id: "reject/pitch",
      title: "Pitch mismatch",
      target: "Reject mismatch",
      requirementRefs: ["FR-010"],
      source: {
        path: "notation/reject.json",
        format: "SHEET_JSON",
        provenance: "self",
      },
      expectedOutcome: "reject",
      rejectionStage: "persisted",
      requiredStages: ["persisted"],
      assertions: [
        {
          id: "reject",
          stage: "persisted",
          kind: "value",
          selector: { path: "error" },
          expected: "INVALID",
        },
      ],
      visualChecklist: [],
    },
  ],
});
test("accepts expected rejection without requiring rendering", () => {
  expect(fixtureManifestSchema.parse(valid()).fixtures).toHaveLength(1);
});
test("rejects empty assertions, duplicate ids, escaped paths and inappropriate rejection stages", () => {
  const variants = [
    { ...valid(), fixtures: [...valid().fixtures, ...valid().fixtures] },
    { ...valid(), fixtures: [{ ...valid().fixtures[0], assertions: [] }] },
    {
      ...valid(),
      fixtures: [
        {
          ...valid().fixtures[0],
          source: { ...valid().fixtures[0].source, path: "../secret" },
        },
      ],
    },
    {
      ...valid(),
      fixtures: [{ ...valid().fixtures[0], requiredStages: ["svg"] }],
    },
  ];
  for (const data of variants)
    expect(fixtureManifestSchema.safeParse(data).success).toBe(false);
});

test("keeps pending visual evidence unreviewed, but requires reviewer identity for a visual pass", async () => {
  const { runSchema } = await import("./manifest");
  const digest = "a".repeat(64);
  const run = {
    runId: "run",
    fixtureId: "head",
    sourceHash: digest,
    expectationHash: digest,
    rendererRevision: digest,
    layout: null,
    executedAt: "2026-10-20T00:00:00.000Z",
    results: [
      {
        fixtureId: "head",
        assertionId: "appearance",
        stage: "visual",
        status: "pending",
        expected: "visible",
        actual: null,
        message: "Not reviewed",
      },
    ],
  };
  expect(runSchema.safeParse(run).success).toBe(true);
  expect(
    runSchema.safeParse({
      ...run,
      results: [{ ...run.results[0], status: "pass" }],
    }).success,
  ).toBe(false);
});

test("partial fixtures require preservation stages and never rendering", () => {
  const value = valid();
  Object.assign(value.fixtures[0], {
    expectedOutcome: "partial",
    rejectionStage: undefined,
    requiredStages: ["import", "roundtrip", "persisted"],
    assertions: ["import", "roundtrip", "persisted"].map((stage) => ({
      id: stage,
      stage,
      kind: "value",
      selector: { path: "candidate.format" },
      expected: "converted-partial-v1",
    })),
  });
  expect(fixtureManifestSchema.safeParse(value).success).toBe(true);
  value.fixtures[0].requiredStages.push("document");
  expect(fixtureManifestSchema.safeParse(value).success).toBe(false);
});
