import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";
import { fixtureManifestSchema } from "./manifest";
const manifest = fixtureManifestSchema.parse(
  JSON.parse(
    await readFile("src/s-core/fixtures/notation/manifest.json", "utf8"),
  ),
);
const baseline = [
  "notehead/whole",
  "notehead/half",
  "notehead/quarter",
  "notehead/eighth",
  "notehead/16th",
  "rest/whole",
  "rest/half",
  "rest/quarter",
  "rest/eighth",
  "rest/16th",
  "dot/single",
  "stem/up",
  "stem/down",
  "flag/up",
  "flag/down",
  "beam/primary",
  "beam/forward-hook",
  "beam/backward-hook",
  "chord/triad",
  "ledger/low",
  "ledger/high",
  "clef/G",
  "clef/F",
  "key/1",
  "key/-1",
  "meter/4-4",
  "meter/change",
  "barline/start",
  "barline/final",
  "staff/multiple",
];
test("has a separate primary fixture and symbol assertions for every basic condition", () => {
  for (const id of baseline) {
    const fixture = manifest.fixtures.find((f) => f.id === id);
    expect(fixture, id).toBeDefined();
    for (const stage of ["document", "svg"])
      expect(
        fixture!.assertions.some(
          (a) => a.stage === stage && a.kind !== "bounds",
        ),
        `${id}/${stage}`,
      ).toBe(true);
  }
});

test("covers every story acceptance condition and required stage for notation", () => {
  const references = new Set(
    manifest.fixtures.flatMap((f) => f.requirementRefs),
  );
  for (const [story, count] of [
    ["US1", 3],
    ["US2", 5],
    ["US3", 4],
  ] as const)
    for (let index = 1; index <= count; index++)
      expect(references.has(`${story}/AC${index}`), `${story}/AC${index}`).toBe(
        true,
      );
  for (const fixture of manifest.fixtures.filter(
    (f) => /^(tie|accidental)\//.test(f.id) && f.expectedOutcome === "render",
  )) {
    for (const stage of [
      "import",
      "roundtrip",
      "persisted",
      "document",
      "svg",
      "visual",
    ] as const)
      expect(fixture.requiredStages, `${fixture.id}/${stage}`).toContain(stage);
  }
});

test("covers every TAB/drum primary condition with applicable stages and independent expectations", async () => {
  const suite = fixtureManifestSchema.parse(
    JSON.parse(
      await readFile("src/s-core/fixtures/tab-drum/manifest.json", "utf8"),
    ),
  );
  const required = [
    ...Array.from(
      { length: 6 },
      (_, index) => `tab/6-string-position-${index + 1}`,
    ),
    ...Array.from(
      { length: 4 },
      (_, index) => `tab/4-string-position-${index + 1}`,
    ),
    ...["0", "9", "10", "36"].map((x) => `tab/fret-${x}`),
    ...["whole", "half", "quarter", "eighth", "16th"].flatMap((x) => [
      `tab/duration-${x}`,
      `tab/rest-${x}`,
      `drum/duration-${x}`,
      `drum/rest-null-${x}`,
    ]),
    ...[
      "kick",
      "snare",
      "closed-hihat",
      "pedal-hihat",
      "high-tom",
      "mid-tom",
      "floor-tom",
      "crash",
      "ride",
    ].map((x) => `drum/${x}`),
    ...["normal", "x"].flatMap((x) =>
      ["whole", "half", "quarter"].map((y) => `drum/${x}-${y}`),
    ),
    ...["tab", "drum"].flatMap((x) =>
      [
        "dotted",
        "stem-up",
        "stem-down",
        "flag-up",
        "flag-down",
        "beam",
        "forward-hook",
        "backward-hook",
        "compressed",
      ].map((y) => `${x}/${y}`),
    ),
    ...[
      "tie-same-bar",
      "tie-cross-bar",
      "tie-system-break",
      "tie-page-break",
      "tuning-explicit",
      "no-tuning",
      "no-sounding-pitch",
      "same-pitch-different-fingering",
      "simultaneous-strings",
    ].map((x) => `tab/${x}`),
    ...[
      "voices",
      "simultaneous",
      "unknown-instrument",
      "position-independent",
      "legacy-numeric-rest",
    ].map((x) => `drum/${x}`),
    ...[
      "normal-tab",
      "normal-drums",
      "all-three",
      "four-line-first",
      "six-line-first",
      "track-four-first",
      "track-six-first",
      "headers",
      "explicit-shared-event",
      "systems",
      "pages",
    ].map((x) => `mixed/${x}`),
  ];
  for (const id of required)
    expect(
      suite.fixtures.some((f) => f.id === id),
      id,
    ).toBe(true);
  const references = new Set(suite.fixtures.flatMap((f) => f.requirementRefs));
  for (const [us, count] of [
    ["US1", 5],
    ["US2", 4],
    ["US3", 3],
  ] as const)
    for (let index = 1; index <= count; index++)
      expect(references.has(`${us}/AC${index}`)).toBe(true);
  for (const f of suite.fixtures) {
    expect(f.assertions.length).toBeGreaterThan(0);
    if (f.expectedOutcome === "render") {
      expect(f.requiredStages).toEqual(
        expect.arrayContaining([
          "import",
          "roundtrip",
          "persisted",
          "document",
          "svg",
          "visual",
        ]),
      );
      for (const stage of ["document", "svg"])
        expect(
          f.assertions.some((a) => a.stage === stage && a.kind !== "bounds"),
          `${f.id}/${stage}`,
        ).toBe(true);
    }
    if (f.expectedOutcome === "partial")
      expect(f.requiredStages).toEqual(["import", "roundtrip", "persisted"]);
  }
});
