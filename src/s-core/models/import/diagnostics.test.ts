import { expect, it } from "vitest";
import { validateCandidate } from "./diagnostics";
import { partialScoreSchema } from "./contracts";
const candidate = {
  format: "converted-partial-v1",
  tracks: [{ id: 0, name: "Piano", preset: 0 }],
  notes: [
    {
      id: "0",
      trackId: 0,
      pitch: 60,
      onset: 0,
      duration: null,
      velocity: 64,
      rest: false,
    },
  ],
  tempos: [],
  timesignatures: [],
  keysignatures: [],
};
it("preserves unknown durations as null and blocks playback even if diagnostics were removed", () => {
  expect(partialScoreSchema.parse(candidate).notes[0].duration).toBeNull();
  const result = validateCandidate(candidate, []);
  expect(result.validation.canPractice).toBe(false);
  expect(result.issues.some((issue) => issue.code === "MISSING_DURATION")).toBe(
    true,
  );
});
it("does not allow resolved labels to hide a still missing field", () => {
  const result = validateCandidate(candidate, [
    {
      id: "missing:0:0:duration",
      code: "MISSING_DURATION",
      severity: "BLOCKING",
      status: "RESOLVED",
      fieldPath: "notes.0.duration",
      message: "Duration missing",
    },
  ]);
  expect(result.validation.canGame).toBe(false);
  expect(
    result.issues.find((issue) => issue.id === "missing:0:0:duration")?.status,
  ).toBe("UNRESOLVED");
});
it("keeps source-dependent blockers after numeric corrections", () => {
  const result = validateCandidate(
    { ...candidate, notes: [{ ...candidate.notes[0], duration: 1 }] },
    [
      {
        id: "repeat",
        code: "UNSUPPORTED_REPEAT",
        severity: "BLOCKING",
        status: "UNRESOLVED",
        message: "Repeat not expanded",
      },
    ],
  );
  expect(result.validation.unresolvedIssueIds).toContain("repeat");
});
it("rejects unknown track references and NaN rather than inventing values", () => {
  expect(() =>
    partialScoreSchema.parse({
      ...candidate,
      notes: [{ ...candidate.notes[0], trackId: 4 }],
    }),
  ).toThrow();
  expect(() =>
    partialScoreSchema.parse({
      ...candidate,
      notes: [{ ...candidate.notes[0], onset: Number.NaN }],
    }),
  ).toThrow();
});

it("keeps display-only warnings playable and source-dependent blockers unresolved", async () => {
  const { readFile } = await import("node:fs/promises");
  const { convertScore } = await import("./convert");
  const imported = await convertScore({
    bytes: await readFile("src/s-core/fixtures/import/quarter.musicxml"),
    options: { mode: "PRESERVE" },
  });
  const issue = {
    id: "source:repeat",
    code: "UNSUPPORTED_REPEAT",
    severity: "BLOCKING" as const,
    status: "UNRESOLVED" as const,
    message: "反復の演奏順を確定できません。",
    track: 0,
    bar: 0,
  };
  const blocked = validateCandidate(imported.candidate, [issue]);
  expect(blocked.validation.canPractice).toBe(false);
  expect(blocked.issues[0].status).toBe("UNRESOLVED");
  const warning = validateCandidate(imported.candidate, [
    {
      ...issue,
      id: "display",
      code: "DISPLAY_INFORMATION_OMITTED",
      severity: "WARNING",
    },
  ]);
  expect(warning.validation.canPractice).toBe(true);
});
