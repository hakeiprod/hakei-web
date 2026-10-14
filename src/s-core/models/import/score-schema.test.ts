import { expect, test } from "vitest";
import { sheetScoreSchema } from "./score-schema";
const fixture = {
  notes: [
    {
      id: 0,
      trackId: 0,
      pitch: 60,
      velocity: 64,
      start: 0,
      duration: 1,
      end: 1,
      staveId: 0,
      rest: false,
      voice: 1,
    },
  ],
  tracks: [
    {
      id: 0,
      name: "Piano",
      preset: 0,
      start: 0,
      duration: 1,
      end: 1,
      staffDetails: {},
    },
  ],
  timesignatures: [
    { start: 0, duration: 1, end: 1, numerator: 4, denominator: 4 },
  ],
  keysignatures: [
    { start: 0, duration: 1, end: 1, accidental: 0, tonality: 0 },
  ],
  tempos: [{ start: 0, duration: 1, end: 1, value: 120 }],
  bars: [{ id: 0, trackId: 0 }],
  masterbars: [{ id: 0, start: 0, duration: 1, end: 1 }],
  staves: [{ id: 0, trackId: 0, barId: 0, clefs: [] }],
  chords: [],
  slots: [],
  rows: [],
};
test("rejects out-of-range musical values and dangling track references", () => {
  for (const change of [
    { pitch: 128 },
    { start: Number.NaN },
    { duration: 0 },
    { trackId: 2 },
    { end: 2 },
  ]) {
    expect(
      sheetScoreSchema.safeParse({
        ...fixture,
        notes: [{ ...fixture.notes[0], ...change }],
      }).success,
    ).toBe(false);
  }
});

test("accepts complete valid Sheet JSON", () => {
  expect(sheetScoreSchema.safeParse(fixture).success).toBe(true);
});

test("accepts the existing multi-bar Sheet export without changing notes", async () => {
  const Core = await import("../core");
  const score = Core.Score.create({
    tracks: [
      {
        notes: [
          { pitch: 60, start: 0, duration: 1 },
          { pitch: 62, start: 4, duration: 1 },
        ],
      },
    ],
  })
    .toSheet()
    .export();
  const snapshot = structuredClone(score);
  // Export crosses a JSON transport boundary; undefined optional fields must be omitted.
  // eslint-disable-next-line unicorn/prefer-structured-clone
  const result = sheetScoreSchema.safeParse(JSON.parse(JSON.stringify(score)));
  expect(
    result.success,
    result.success ? "" : JSON.stringify(result.error.issues),
  ).toBe(true);
  expect(score).toEqual(snapshot);
});

test("historical Sheet export may omit derived track duration, but not note duration", () => {
  const old = structuredClone(fixture) as {
    tracks: Partial<(typeof fixture.tracks)[number]>[];
    notes: Partial<(typeof fixture.notes)[number]>[];
  };
  delete old.tracks[0].duration;
  expect(sheetScoreSchema.safeParse(old).success).toBe(true);
  delete old.notes[0].duration;
  expect(sheetScoreSchema.safeParse(old).success).toBe(false);
});

test("note identifiers from the existing Core export are scoped to each track", async () => {
  const Core = await import("../core");
  const exported = Core.Score.create({
    tracks: [
      { notes: [{ pitch: 60, start: 0, duration: 1 }] },
      { notes: [{ pitch: 64, start: 0, duration: 1 }] },
    ],
  })
    .toSheet()
    .export();
  // Persisted Sheet JSON omits optional values and serializes Beat instances.
  // eslint-disable-next-line unicorn/prefer-structured-clone
  const transported = JSON.parse(JSON.stringify(exported));
  expect(sheetScoreSchema.safeParse(transported).success).toBe(true);
  transported.notes.push({ ...transported.notes[0] });
  expect(sheetScoreSchema.safeParse(transported).success).toBe(false);
});
