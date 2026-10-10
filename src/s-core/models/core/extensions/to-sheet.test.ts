/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import * as Core from "..";
import "./to-sheet";

const fixtures = import.meta.glob("../../../fixtures/core/*.json", {
  eager: true,
  import: "default",
}) as Record<string, Parameters<typeof Core.Score.create>[0]>;

describe("Core.Score.toSheet", () => {
  test.each(Object.entries(fixtures))(
    "loads and lays out fixture %s without throwing",
    (_path, fixture) => {
      const score = Core.Score.create(fixture).toSheet();

      for (const note of score.notes) {
        note.draw();
        expect(Number.isFinite(note.line)).toBe(true);
      }
      for (const chord of score.chords) chord.draw();
    },
  );
});

function notation(
  notes: { pitch: number; start: number; duration: number }[],
  numerator = 4,
  denominator = 4,
) {
  return Core.Score.create({
    tracks: [{ notes }],
    timesignatures: [{ numerator, denominator }],
  }).toSheet();
}

describe("automatic beams", () => {
  test("groups eighth notes by beat in simple meters", () => {
    const sheet = notation(
      Array.from({ length: 8 }, (_, index) => ({
        pitch: 60,
        start: index / 2,
        duration: 0.5,
      })),
    );
    expect(sheet.beamGroups.map((group) => group.chordIds.length)).toEqual([
      2, 2, 2, 2,
    ]);
    expect(sheet.notes.map((note) => note.beam?.[0]?._)).toEqual([
      "begin",
      "end",
      "begin",
      "end",
      "begin",
      "end",
      "begin",
      "end",
    ]);
  });

  test.each([
    { numerator: 6, sizes: [3, 3] },
    { numerator: 9, sizes: [3, 3, 3] },
    { numerator: 5, sizes: [2, 3] },
  ])(
    "groups eighth notes in $numerator/8 according to the meter",
    ({ numerator, sizes }) => {
      const sheet = notation(
        Array.from({ length: numerator }, (_, index) => ({
          pitch: 60,
          start: index / 2,
          duration: 0.5,
        })),
        numerator,
        8,
      );
      expect(sheet.beamGroups.map((group) => group.chordIds.length)).toEqual(
        sizes,
      );
    },
  );

  test("generates all beam levels for sixteenth notes", () => {
    const sheet = notation(
      Array.from({ length: 4 }, (_, index) => ({
        pitch: 60,
        start: index / 4,
        duration: 0.25,
      })),
    );
    expect(
      sheet.beamGroups.map((group) => [group.level, group.chordIds.length]),
    ).toEqual([
      [0, 4],
      [1, 4],
    ]);
    for (const note of sheet.notes.filter((note) => !note.rest)) {
      expect(note.beam).toHaveLength(2);
      expect(note.beam?.map((beam) => Number(beam.$?.number))).toEqual([1, 2]);
    }
  });

  test.each([
    [0.75, 0.25, "backward hook"],
    [0.25, 0.75, "forward hook"],
  ] as const)("adds the secondary %s + %s beam hook", (first, second, hook) => {
    const sheet = notation([
      { pitch: 60, start: 0, duration: first },
      { pitch: 62, start: first, duration: second },
    ]);
    expect(
      sheet.beamGroups.find((group) => group.level === 0)?.chordIds,
    ).toHaveLength(2);
    const shorter = sheet.notes.find((note) => note.duration.value === 0.25)!;
    expect(shorter.beam?.[1]?._).toBe(hook);
  });

  test("breaks at rests and gaps, leaving isolated eighth notes flagged", () => {
    const sheet = notation([
      { pitch: 60, start: 0, duration: 0.25 },
      { pitch: 60, start: 0.5, duration: 0.25 },
      { pitch: 60, start: 1, duration: 0.5 },
      { pitch: 60, start: 1.5, duration: 0.5 },
    ]);
    expect(sheet.beamGroups).toHaveLength(1);
    expect(
      sheet.notes
        .filter((note) => note.start.value < 1)
        .every((note) => !note.beam),
    ).toBe(true);
    expect(
      sheet.notes.filter((note) => note.rest).every((note) => !note.beam),
    ).toBe(true);
  });

  test("does not connect across barlines or include quarter notes", () => {
    const sheet = notation([
      { pitch: 60, start: 0, duration: 1 },
      { pitch: 60, start: 3.5, duration: 0.5 },
      { pitch: 60, start: 4, duration: 0.5 },
    ]);
    expect(sheet.beamGroups).toHaveLength(0);
    expect(sheet.notes.every((note) => !note.beam)).toBe(true);
  });

  test("keeps tracks and piano staves separate and beams entire chords", () => {
    const sheet = Core.Score.create({
      tracks: [
        {
          notes: [48, 52, 60, 64].flatMap((pitch) => [
            { pitch, start: 0, duration: 0.5 },
            { pitch: pitch + 2, start: 0.5, duration: 0.5 },
          ]),
        },
        {
          notes: [0, 0.5].map((start) => ({ pitch: 72, start, duration: 0.5 })),
        },
      ],
    }).toSheet();
    expect(sheet.beamGroups).toHaveLength(3);
    expect(
      sheet.beamGroups
        .map((group) => [group.trackId, group.staveId])
        .toSorted(),
    ).toEqual([
      [0, 0],
      [0, 1],
      [1, 0],
    ]);
    for (const group of sheet.beamGroups) {
      expect(group.chordIds).toHaveLength(2);
      for (const id of group.chordIds) {
        const notes = sheet.getNotesByChordId(id);
        expect(
          notes.every(
            (note) =>
              note.trackId === group.trackId &&
              note.staveId === group.staveId &&
              note.beam,
          ),
        ).toBe(true);
      }
    }
  });

  test("orders unsorted input and assigns one stem direction to a beam group", () => {
    const sheet = notation([
      { pitch: 84, start: 0.5, duration: 0.5 },
      { pitch: 60, start: 0, duration: 0.5 },
    ]);
    expect(sheet.beamGroups[0].firstChord.start.value).toBe(0);
    expect(sheet.beamGroups[0].lastChord.start.value).toBe(0.5);
    expect(
      sheet.notes.filter((note) => !note.rest).map((note) => note.stem?._),
    ).toEqual(["down", "down"]);
  });

  test("uses the new meter after a time signature change", () => {
    const sheet = Core.Score.create({
      tracks: [
        {
          notes: Array.from({ length: 6 }, (_, index) => ({
            pitch: 60,
            start: 4 + index / 2,
            duration: 0.5,
          })),
        },
      ],
      timesignatures: [
        { numerator: 4, denominator: 4, start: 0 },
        { numerator: 6, denominator: 8, start: 4 },
      ],
    }).toSheet();
    expect(
      sheet.beamGroups.map((group) => [group.barId, group.chordIds.length]),
    ).toEqual([
      [1, 3],
      [1, 3],
    ]);
  });
});
