// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest";
import { firstBy, prop } from "remeda";
import { Track } from "./track";
import type { Score as SheetScore } from "../sheet";
import { Preset, type MidiNoteNumber } from "../core/units";
import { NonNegativeIntSchema } from "../validator";

afterEach(() => vi.restoreAllMocks());
function setup(values: number[]) {
  const track = new Track({ id: 0, preset: new Preset(0) });
  // Deliberately include invalid raw values to retain the legacy getter's filter.
  const notes = values.map((value) => ({
    trackId: 0,
    pitch: { value } as MidiNoteNumber,
  }));
  Object.assign(track, { score: { notes } });
  return { track, notes };
}
function legacy(notes: ReturnType<typeof setup>["notes"]) {
  return (["asc", "desc"] as const).map(
    (sort) =>
      firstBy(
        notes.filter(
          (note) => NonNegativeIntSchema.safeParse(note.pitch.value).success,
        ),
        [prop("pitch", "value"), sort],
      )!.pitch,
  );
}

test.each(
  [
    [72, 60, 72, 60],
    [0, 127, 60],
    [-0, 0, -0],
    [Number.NaN, -1, 1.5, Number.POSITIVE_INFINITY, 60, 72],
    [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, 0],
  ].map((values) => ({ values })),
)(
  "key range keeps the old bounds and first equal-pitch objects for $values",
  ({ values }) => {
    const { track, notes } = setup(values);
    const expected = legacy(notes);
    expect(track.keyRange[0]).toBe(expected[0]);
    expect(track.keyRange[1]).toBe(expected[1]);
  },
);

test.each([[], [-1, Number.NaN, 1.5]].map((values) => ({ values })))(
  "no valid pitch keeps the legacy failure for $values",
  ({ values }) => {
    const { track, notes } = setup(values);
    expect(() => legacy(notes)).toThrow(TypeError);
    expect(() => track.keyRange).toThrow(TypeError);
  },
);

test("repeated pitches do not repeat schema validation for every note or retain stale ranges", () => {
  const { track, notes } = setup(
    Array.from({ length: 5540 }, (_, index) => 36 + (index % 88)),
  );
  const expected = legacy(notes);
  const parse = vi.spyOn(NonNegativeIntSchema, "safeParse");
  const range = track.keyRange;
  expect(range[0]).toBe(expected[0]);
  expect(range[1]).toBe(expected[1]);
  expect(parse.mock.calls.length).toBeGreaterThan(0);
  expect(parse.mock.calls.length).toBeLessThanOrEqual(88);
  Object.assign(track.score, { notes: [{ trackId: 0, pitch: { value: 12 } }] });
  expect(track.keyRange.map((pitch) => pitch.value)).toEqual([12, 12]);
});

test.each(["quarter_middle_c.mxl", "naitoobunaitsu-bitomario.mxl"])(
  "official %s audio keeps every old pitch-range object and serialized note",
  async (file) => {
    const { readFile } = await import("node:fs/promises");
    const { convertScore } = await import("../import/convert");
    const Sheet = await import("../sheet");
    await import("../sheet/extensions/to-audio");
    const converted = await convertScore({
      bytes: await readFile(`src/s-core/fixtures/files/musicxml/${file}`),
      options: { mode: "PRESERVE" },
    });
    if ("format" in converted.candidate)
      throw new Error("Complete fixture required");
    const audio = Sheet.Score.import(
      converted.candidate as unknown as ReturnType<SheetScore["export"]>,
    ).toAudio();
    const before = JSON.stringify(audio.export());
    for (const track of audio.tracks) {
      if (track.notes.length === 0) continue;
      const expected = legacy(track.notes);
      const actual = track.keyRange;
      expect(actual[0]).toBe(expected[0]);
      expect(actual[1]).toBe(expected[1]);
    }
    expect(JSON.stringify(audio.export())).toBe(before);
  },
  30_000,
);
