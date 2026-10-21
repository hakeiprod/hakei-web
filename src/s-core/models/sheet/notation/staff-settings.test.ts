/* Normalize parser/model data through the actual JSON transport boundary. */
/* eslint-disable unicorn/prefer-structured-clone */
import { expect, test } from "vitest";
import { staffSettingsSchema } from "./staff-settings";
import { sheetScoreSchema } from "../../import/score-schema";
import { partialNoteSchema } from "../../import/contracts";
import { Score } from "../../core";
import "../../core/extensions/to-sheet";
function score() {
  return Score.create({
    tracks: [{ name: "test", notes: [{ pitch: 60, start: 0, duration: 1 }] }],
  })
    .toSheet()
    .export();
}
test("validates staff and tuning boundaries", () => {
  expect(
    staffSettingsSchema.safeParse({ kind: "tablature", lineCount: 6 }).success,
  ).toBe(true);
  for (const lineCount of [0, 5, 7])
    expect(
      staffSettingsSchema.safeParse({ kind: "tablature", lineCount }).success,
    ).toBe(false);
  expect(
    staffSettingsSchema.safeParse({ kind: "percussion", lineCount: 5 }).success,
  ).toBe(true);
  expect(
    staffSettingsSchema.safeParse({
      kind: "tablature",
      lineCount: 4,
      tuning: [{ string: 5, step: "E", octave: 2, alter: 0 }],
    }).success,
  ).toBe(false);
});
test("distinguishes complete unpitched hits and rests from incomplete normal notes", () => {
  const s = score();
  s.staves[0] = {
    ...s.staves[0],
    staffSettings: { kind: "percussion", lineCount: 5 },
  } as (typeof s.staves)[number];
  const data = JSON.parse(JSON.stringify(s));
  data.notes[0].pitch = null;
  data.notes[0].rest = true;
  expect(sheetScoreSchema.safeParse(data).success).toBe(true);
  data.notes[0].rest = false;
  expect(sheetScoreSchema.safeParse(data).success).toBe(false);
  data.notes[0].percussion = {
    displayStep: "C",
    displayOctave: 5,
    notehead: "x",
  };
  expect(sheetScoreSchema.safeParse(data).success).toBe(true);
  data.notes[0].rest = true;
  expect(sheetScoreSchema.safeParse(data).success).toBe(false);
  delete data.notes[0].percussion;
  data.staves[0].staffSettings = { kind: "standard", lineCount: 5 };
  data.notes[0].rest = false;
  expect(sheetScoreSchema.safeParse(data).success).toBe(false);
  expect(
    partialNoteSchema.safeParse({
      id: "0",
      trackId: 0,
      pitch: null,
      onset: null,
      duration: null,
      velocity: 80,
      rest: false,
    }).success,
  ).toBe(true);
});
