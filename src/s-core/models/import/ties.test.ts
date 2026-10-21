import { expect, it } from "vitest";
import * as Core from "../core";
import { validateCandidate } from "./diagnostics";
function score() {
  // JSON transport strips optional undefined fields before schema verification.
  // eslint-disable-next-line unicorn/prefer-structured-clone
  return JSON.parse(
    JSON.stringify(
      Core.Score.create({
        tracks: [
          {
            notes: [
              { pitch: 60, start: 0, duration: 1 },
              { pitch: 60, start: 1, duration: 1 },
            ],
          },
        ],
      })
        .toSheet()
        .export(),
    ),
  );
}
it("validates tie continuity after edits instead of accepting a stale playable flag", () => {
  const candidate = score();
  candidate.notes[0].ties = ["start"];
  candidate.notes[1].ties = ["stop"];
  expect(validateCandidate(candidate, []).validation.canPractice).toBe(true);
  candidate.notes[1].pitch = 62;
  const broken = validateCandidate(candidate, []);
  expect(broken.validation.canPractice).toBe(false);
  expect(broken.issues.some((issue) => issue.code === "UNMATCHED_TIE")).toBe(
    true,
  );
  candidate.notes[1].pitch = 60;
  expect(
    validateCandidate(candidate, broken.issues).validation.canPractice,
  ).toBe(true);
});

it("reports ambiguous unison starts instead of silently overwriting a pending tie", () => {
  const candidate = score();
  candidate.notes[0].ties = ["start"];
  candidate.notes[1].ties = ["stop"];
  candidate.notes.push({ ...candidate.notes[0], id: 99, ties: ["start"] });
  const result = validateCandidate(candidate, []);
  expect(
    result.issues.some(
      (index) =>
        index.code === "AMBIGUOUS_TIE" && index.severity === "BLOCKING",
    ),
  ).toBe(true);
  expect(result.validation.canPractice).toBe(false);
});
