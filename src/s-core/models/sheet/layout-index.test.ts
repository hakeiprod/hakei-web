import { describe, expect, test } from "vitest";
import * as Core from "../core";
import "../core/extensions/to-sheet";
import * as Sheet from ".";
import { LayoutIndex } from "./layout-index";

function expectReferences(actual: unknown[] | undefined, expected: unknown[]) {
  expect(actual?.length).toBe(expected.length);
  expect(actual?.map((entry, index) => entry === expected[index])).toEqual(
    expected.map(() => true),
  );
}

function example() {
  return Core.Score.create({
    tracks: [
      {
        notes: [
          { pitch: 60, start: 0, duration: 8 },
          { pitch: 62, start: 0.3, duration: 1 },
          { pitch: 64, start: 0.1 + 0.2, duration: 1 },
          { pitch: 65, start: 4, duration: 1 },
        ],
      },
      {
        notes: [
          { pitch: 48, start: 0, duration: 1 },
          { pitch: 50, start: 4, duration: 1 },
        ],
      },
    ],
  }).toSheet();
}

describe("LayoutIndex", () => {
  test("preserves original note/slot order, exact beats and track/staff identity", () => {
    const score = example();
    score.layoutIndex = null;
    score.notesByChordId = null;
    const expected = {
      masterbars: score.masterbars.map((bar) => ({
        notes: bar.notes,
        chords: bar.chords,
        slots: bar.slots,
        bars: bar.bars,
      })),
      staves: score.staves.map((stave) => ({
        notes: stave.notes,
        chords: stave.chords,
        slots: stave.slots,
        bar: stave.bar,
      })),
      chords: score.chords.map((chord) => ({
        notes: chord.notes,
        slot: chord.slot,
        stave: chord.stave,
      })),
    };
    const index = new LayoutIndex(score);
    for (const [index_, bar] of score.masterbars.entries()) {
      expectReferences(
        index.masterbarNotes.get(bar),
        expected.masterbars[index_].notes,
      );
      expectReferences(
        index.masterbarChords.get(bar),
        expected.masterbars[index_].chords,
      );
      expectReferences(
        index.masterbarSlots.get(bar),
        expected.masterbars[index_].slots,
      );
      expectReferences(
        index.masterbarBars.get(bar),
        expected.masterbars[index_].bars,
      );
    }
    for (const [index_, stave] of score.staves.entries()) {
      expectReferences(
        index.staveNotes.get(stave),
        expected.staves[index_].notes,
      );
      expectReferences(
        index.staveChords.get(stave),
        expected.staves[index_].chords,
      );
      expectReferences(
        index.staveSlots.get(stave),
        expected.staves[index_].slots,
      );
      expect(index.staveBar.get(stave) === expected.staves[index_].bar).toBe(
        true,
      );
    }
    for (const [index_, chord] of score.chords.entries()) {
      expectReferences(
        index.notesByChordId.get(chord.id),
        expected.chords[index_].notes,
      );
      expect(index.chordSlot.get(chord) === expected.chords[index_].slot).toBe(
        true,
      );
      expect(
        index.chordStave.get(chord) === expected.chords[index_].stave,
      ).toBe(true);
    }
    const fractional = score.slots.filter(
      (slot) => slot.beat.value > 0 && slot.beat.value < 1,
    );
    expect(new Set(fractional.map((slot) => slot.beat.value)).size).toBe(2);
    expect(
      index.slotChords.get(fractional[0])?.map((chord) => chord.id),
    ).not.toEqual(
      index.slotChords.get(fractional[1])?.map((chord) => chord.id),
    );
    expect(
      index.masterbarNotes
        .get(score.masterbars[1])
        ?.some((note) => note.start.value === 0),
    ).toBe(true);
    expect(
      index.masterbarSlots
        .get(score.masterbars[1])
        ?.some((slot) => slot.beat.value === 0),
    ).toBe(false);
  });

  test("retains directional zero-length overlap at both interval boundaries", () => {
    const score = example();
    const note = score.notes[0];
    note._start = new Core.Units.Beat(4);
    note._end = new Core.Units.Beat(4);
    note._duration = new Core.Units.Beat(0);
    const index = new LayoutIndex(score);
    expect(index.masterbarNotes.get(score.masterbars[0])).toContain(note);
    expect(index.masterbarNotes.get(score.masterbars[1])).not.toContain(note);
    for (const bar of score.masterbars)
      expect(index.masterbarNotes.get(bar)?.map((n) => n.id)).toEqual(
        score.notes.filter((n) => n.isOverlapped(bar)).map((n) => n.id),
      );
  });

  test("keeps every beam level and preserves first membership selection", () => {
    const score = example(),
      chord = score.chords[0],
      stave = chord.stave;
    score.beamGroups = [0, 1].map((level) => {
      const beam = new Sheet.BeamGroup({
        level,
        chordIds: [chord.id],
        trackId: stave.trackId,
        barId: stave.barId,
        staveId: stave.id,
      });
      beam.score = score;
      return beam;
    });
    const index = new LayoutIndex(score);
    expectReferences(index.chordBeams.get(chord), score.beamGroups);
    expectReferences(index.staveBeams.get(stave), score.beamGroups);
  });

  test("rejects duplicate unique IDs but accepts note IDs repeated in separate tracks", () => {
    const score = example();
    expect(() => new LayoutIndex(score)).not.toThrow();
    score.chords.push(score.chords[0]);
    expect(() => new LayoutIndex(score)).toThrow(/duplicate.*chord/i);
  });

  test("publishes only a complete rebuilt index and never shares scores or stale chord membership", () => {
    const score = example(),
      other = example();
    score.rebuildLayoutIndex();
    const old = score.layoutIndex;
    expect(old).toBeInstanceOf(LayoutIndex);
    expect(other.layoutIndex === old).toBe(false);
    const note = score.notes[1],
      destination = score.chords.at(-1)!;
    const oldChord = note.chordId;
    note.chordId = destination.id;
    score.chords = score.chords.filter((chord) => chord.id !== oldChord);
    score.rebuildLayoutIndex();
    expect(score.layoutIndex === old).toBe(false);
    expect(score.getNotesByChordId(destination.id).includes(note)).toBe(true);
    expect(score.export()).not.toHaveProperty("layoutIndex");
    score.chords.push(score.chords[0]);
    expect(() => score.rebuildLayoutIndex()).toThrow();
    expect(score.layoutIndex).toBeNull();
  });
});
