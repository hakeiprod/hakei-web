// Exercise persisted JSON transport, which drops undefined optional model fields.
/* eslint-disable unicorn/prefer-structured-clone */
import { expect, it } from "vitest";
import * as Core from "../core";
import { Timeline } from "./timeline";
import { Conditions } from "./conditions";
import { TempoMap } from "./tempo-map";
const buildTimeline = (score: unknown, conditions: unknown) =>
  Timeline.create(score, Conditions.import(conditions)).export();
const conditions = {
  trackId: 0,
  rangeStartBar: 1,
  rangeEndBar: 2,
  tempoScale: 1,
  calibrationUs: 0,
  mode: "PRACTICE" as const,
  ruleVersion: 1,
};
function score() {
  return JSON.parse(
    JSON.stringify(
      Core.Score.create({
        tracks: [
          {
            notes: [
              { pitch: 60, start: 0, duration: 1 },
              { pitch: 62, start: 4, duration: 1 },
              { pitch: 64, start: 8, duration: 1 },
            ],
          },
        ],
        tempos: [
          { start: 0, value: 120 },
          { start: 4, value: 60 },
        ],
      })
        .toSheet()
        .export(),
    ),
  );
}
it("integrates tempo changes, scale and range origin with an exclusive final endpoint", () => {
  const data = score();
  const before = structuredClone(data);
  const timeline = buildTimeline(data, conditions);
  expect(timeline.notes.map((note) => [note.pitch, note.onsetUs])).toEqual([
    [60, 0],
    [62, 2_000_000],
  ]);
  expect(timeline.durationUs).toBe(6_000_000);
  expect(
    buildTimeline(data, { ...conditions, tempoScale: 2 }).notes[1].onsetUs,
  ).toBe(1_000_000);
  expect(
    buildTimeline(data, { ...conditions, rangeStartBar: 2 }).notes.map(
      (note) => [note.pitch, note.onsetUs],
    ),
  ).toEqual([[62, 0]]);
  expect(data).toEqual(before);
});
it("excludes rests and tie continuation attacks while describing continuation notes", () => {
  const data = JSON.parse(
    JSON.stringify(
      Core.Score.create({
        tracks: [
          {
            notes: [
              { pitch: 60, start: 0, duration: 4 },
              { pitch: 60, start: 4, duration: 1 },
              { pitch: 64, start: 8, duration: 1 },
            ],
          },
        ],
      })
        .toSheet()
        .export(),
    ),
  );
  data.notes.find(
    (note: { id: number; rest: boolean }) => note.id === 0 && !note.rest,
  ).ties = ["start"];
  data.notes.find(
    (note: { id: number; rest: boolean }) => note.id === 1 && !note.rest,
  ).ties = ["stop"];
  const timeline = buildTimeline(data, { ...conditions, rangeStartBar: 2 });
  expect(timeline.notes).toEqual([]);
  expect(timeline.continuations.map((note) => note.pitch)).toEqual([60]);
});
it("rejects unavailable tracks/bars and nonfinite music clocks", () => {
  expect(() =>
    buildTimeline(score(), { ...conditions, trackId: 99 }),
  ).toThrow();
  expect(() =>
    buildTimeline(score(), { ...conditions, rangeEndBar: 99 }),
  ).toThrow();
  expect(() => new TempoMap([{ start: 0, value: 0 }], 1)).toThrow();
});
it("extends tied reference sound once and clips a pre-range sustained note as continuation", () => {
  const data = JSON.parse(
    JSON.stringify(
      Core.Score.create({
        tracks: [
          {
            notes: [
              { pitch: 60, start: 0, duration: 4 },
              { pitch: 60, start: 4, duration: 1 },
            ],
          },
        ],
      })
        .toSheet()
        .export(),
    ),
  );
  data.notes.find(
    (note: { id: number; rest: boolean }) => note.id === 0 && !note.rest,
  ).ties = ["start"];
  data.notes.find(
    (note: { id: number; rest: boolean }) => note.id === 1 && !note.rest,
  ).ties = ["stop"];
  const full = buildTimeline(data, conditions);
  expect(full.notes).toHaveLength(1);
  expect(full.notes[0].durationUs).toBe(2_500_000);
  expect(full.continuations[0].continuedFrom).toBe(full.notes[0].noteId);
  const sustained = JSON.parse(
    JSON.stringify(
      Core.Score.create({
        tracks: [{ notes: [{ pitch: 60, start: 0, duration: 8 }] }],
      })
        .toSheet()
        .export(),
    ),
  );
  expect(
    buildTimeline(sustained, { ...conditions, rangeStartBar: 2 })
      .continuations[0],
  ).toMatchObject({ onsetUs: 0, durationUs: 2_000_000 });
});
