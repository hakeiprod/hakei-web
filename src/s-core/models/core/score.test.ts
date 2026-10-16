import { expect, it } from "vitest";
import { Score } from "./score";
import { Keyboard } from "../browser/keyboard";
import { MidiNoteNumber } from "./units";
it("retains MIDI pitch zero in the accepted score range", () => {
  const score = Score.create({
    tracks: [
      {
        notes: [
          { pitch: 0, start: 0, duration: 1 },
          { pitch: 127, start: 1, duration: 1 },
        ],
      },
    ],
  });
  expect(score.keyRange.map((pitch) => pitch.value)).toEqual([0, 127]);
});
it("renders both inclusive endpoints and a single-note keyboard", () => {
  expect(
    new Keyboard([new MidiNoteNumber(60), new MidiNoteNumber(60)]).rangeKeys,
  ).toEqual([60]);
  expect(
    new Keyboard([new MidiNoteNumber(0), new MidiNoteNumber(127)]).rangeKeys,
  ).toHaveLength(128);
});
