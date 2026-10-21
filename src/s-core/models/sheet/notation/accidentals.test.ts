import { expect, test } from "vitest";
import { resolveAccidentals } from "./accidentals";
const base = {
  id: 0,
  trackId: 0,
  staveId: 0,
  voice: 1,
  pitch: 61,
  start: 0,
  duration: 1,
  rest: false,
  notatedPitch: { step: "C" as const, octave: 4, alter: 1 },
};
const bars = [
  { id: 0, start: 0, end: 4 },
  { id: 1, start: 4, end: 8 },
];
const keys = [{ start: 0, accidental: 0 }];
test("shares voices within a bar, resets at bar boundaries and renders natural", () => {
  const notes = [
    base,
    { ...base, id: 1, start: 1, voice: 2 },
    {
      ...base,
      id: 2,
      start: 2,
      pitch: 60,
      notatedPitch: { ...base.notatedPitch, alter: 0 },
    },
    { ...base, id: 3, start: 4 },
  ];
  const result = resolveAccidentals(notes, bars, keys);
  expect(notes.map((n) => result.get(`0:${n.id}`)?.kind)).toEqual([
    "sharp",
    undefined,
    "natural",
    "sharp",
  ]);
});
test("isolates octaves and staves; explicit parentheses are never suppressed", () => {
  const notes = [
    base,
    { ...base, id: 1, start: 1, staveId: 1 },
    {
      ...base,
      id: 2,
      start: 2,
      pitch: 73,
      notatedPitch: { ...base.notatedPitch, octave: 5 },
    },
    {
      ...base,
      id: 3,
      start: 3,
      explicitAccidental: { kind: "sharp" as const, parentheses: true },
    },
  ];
  const result = resolveAccidentals(notes, bars, keys);
  expect(notes.map((n) => result.get(`0:${n.id}`)?.kind)).toEqual([
    "sharp",
    "sharp",
    "sharp",
    "sharp",
  ]);
  expect(result.get("0:3")?.parentheses).toBe(true);
});
test("simultaneous conflicts are order independent and force a later reminder", () => {
  const natural = {
    ...base,
    id: 1,
    pitch: 60,
    notatedPitch: { ...base.notatedPitch, alter: 0 },
  };
  const notes = [base, natural, { ...base, id: 2, start: 1 }];
  expect([...resolveAccidentals(notes, bars, keys)]).toEqual([
    ...resolveAccidentals(notes.toReversed(), bars, keys),
  ]);
  expect(resolveAccidentals(notes, bars, keys).get("0:2")?.kind).toBe("sharp");
});
