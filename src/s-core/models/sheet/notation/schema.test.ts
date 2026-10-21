import { describe, expect, test } from "vitest";
import { notationSchema } from "./schema";

describe("notation boundary", () => {
  test("keeps absence separate from an explicit empty visual tie list", () => {
    expect(notationSchema.parse({})).toEqual({});
    expect(notationSchema.parse({ visualTies: [] })).toEqual({
      visualTies: [],
    });
  });
  test("validates original spelling against sounding pitch", () => {
    expect(
      notationSchema.safeParse({
        pitch: 61,
        notatedPitch: { step: "D", octave: 4, alter: -1 },
      }).success,
    ).toBe(true);
    expect(
      notationSchema.safeParse({
        pitch: 60,
        notatedPitch: { step: "D", octave: 4, alter: -1 },
      }).success,
    ).toBe(false);
    expect(
      notationSchema.safeParse({
        pitch: null,
        notatedPitch: { step: "D", octave: 4, alter: -1 },
      }).success,
    ).toBe(true);
  });
  test("rejects contradictory accidentals, rests, invalid bounds and duplicate ties", () => {
    for (const data of [
      { notatedPitch: { step: "H", octave: 4, alter: 0 } },
      { notatedPitch: { step: "C", octave: 10, alter: 0 } },
      { notatedPitch: { step: "C", octave: 4, alter: 3 } },
      {
        notatedPitch: { step: "C", octave: 4, alter: 1 },
        explicitAccidental: { kind: "natural" },
      },
      { rest: true, visualTies: [{ type: "start" }] },
      { visualTies: [{ type: "start", number: 0 }] },
      { visualTies: [{ type: "start", number: 17 }] },
      { visualTies: [{ type: "start" }, { type: "start" }] },
      { visualTies: Array.from({ length: 33 }, () => ({ type: "start" })) },
    ])
      expect(notationSchema.safeParse(data).success).toBe(false);
  });
});
