/* Serialized JSON transport intentionally drops undefined fields. */
/* eslint-disable unicorn/prefer-structured-clone */
import { expect, test } from "vitest";
import * as Core from "../../core";
import "../../core/extensions/to-sheet";
import * as Sheet from "..";
import { sheetScoreSchema } from "../../import/score-schema";
import { promotePartial } from "../../import/promote-partial";
const fields = {
  notatedPitch: { step: "D" as const, octave: 4, alter: -1 },
  explicitAccidental: { kind: "flat" as const, parentheses: true },
  visualTies: [],
};
function base() {
  return JSON.parse(
    JSON.stringify(
      Core.Score.create({
        tracks: [{ notes: [{ pitch: 61, start: 0, duration: 1 }] }],
      })
        .toSheet()
        .export(),
    ),
  );
}
test("preserves supplied notation and legacy absence through validated model transport", () => {
  const original = base();
  expect(Sheet.Score.import(original).export().notes[0]).not.toHaveProperty(
    "notatedPitch",
  );
  Object.assign(original.notes[0], fields);
  const parsed = sheetScoreSchema.parse(original);
  const result = Sheet.Score.import(
    parsed as unknown as ReturnType<Sheet.Score["export"]>,
  ).export();
  expect(result.notes[0]).toMatchObject(fields);
  expect(original.notes[0].pitch).toBe(61);
});
test("promotes both notation and Core fallback without dropping supplied notation or stem/beam", () => {
  const score = base();
  const note = score.notes[0];
  const notation = { ...score };
  delete notation.notes;
  const partial = {
    format: "converted-partial-v1",
    tracks: [{ id: 0, name: "test", preset: 0 }],
    notes: [
      {
        id: "0",
        trackId: 0,
        staveId: 0,
        voice: 1,
        chordId: note.chordId,
        pitch: 61,
        onset: 0,
        duration: 1,
        velocity: 100,
        rest: false,
        stem: { _: "down" },
        beam: [],
        ...fields,
      },
    ],
    tempos: [{ start: 0, value: 120 }],
    timesignatures: [{ start: 0, numerator: 4, denominator: 4 }],
    keysignatures: [{ start: 0, accidental: 0, tonality: 0 }],
  };
  for (const input of [partial, { ...partial, notation }]) {
    const promoted = promotePartial(input).candidate;
    expect(promoted.notes[0]).toMatchObject({
      ...fields,
      stem: { _: "down" },
      beam: [],
    });
  }
});

test("keeps ambiguous Core-fallback notation as partial instead of silently discarding it", () => {
  const note = {
    id: "0",
    trackId: 0,
    pitch: 61,
    onset: 0,
    duration: 1,
    velocity: 100,
    rest: false,
    ...fields,
  };
  const candidate = {
    format: "converted-partial-v1",
    tracks: [{ id: 0, name: "unison", preset: 0 }],
    notes: [note, { ...note, id: "1", voice: 2 }],
    tempos: [{ start: 0, value: 120 }],
    timesignatures: [{ start: 0, numerator: 4, denominator: 4 }],
    keysignatures: [{ start: 0, accidental: 0, tonality: 0 }],
  };
  const promoted = promotePartial(candidate);
  expect(promoted.candidate).toHaveProperty("format", "converted-partial-v1");
  expect(promoted.candidate.notes[0]).toMatchObject(fields);
  expect(
    promoted.issues.some(
      (issue) =>
        issue.code === "NOTATION_PROMOTION_AMBIGUOUS" &&
        issue.severity === "BLOCKING",
    ),
  ).toBe(true);
});
