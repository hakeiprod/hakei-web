import { expect, it } from "vitest";
import { convertMidi } from "./midi";
function file(events: number[]) {
  return new Uint8Array([
    77,
    84,
    104,
    100,
    0,
    0,
    0,
    6,
    0,
    0,
    0,
    1,
    1,
    224,
    77,
    84,
    114,
    107,
    0,
    0,
    0,
    events.length,
    ...events,
  ]);
}
it("returns a missing duration for an unclosed note", () => {
  const result = convertMidi(file([0, 144, 60, 90, 0, 255, 47, 0]), {
    mode: "PRESERVE",
  });
  expect(result.candidate).toMatchObject({
    format: "converted-partial-v1",
    notes: [{ pitch: 60, duration: null }],
  });
  expect(
    result.issues.some(
      (issue) =>
        issue.code === "MIDI_UNCLOSED_NOTE" && issue.severity === "BLOCKING",
    ),
  ).toBe(true);
});
it("pairs repeated notes FIFO and reports overlapping ambiguity", () => {
  const result = convertMidi(
    file([
      0, 144, 60, 90, 120, 144, 60, 80, 120, 128, 60, 0, 120, 128, 60, 0, 0,
      255, 47, 0,
    ]),
    { mode: "PRESERVE" },
  );
  expect(
    result.issues.some((issue) => issue.code === "MIDI_OVERLAPPING_SAME_PITCH"),
  ).toBe(true);
  expect(
    result.candidate.notes
      .filter((note) => !note.rest)
      .map((note) => note.duration),
  ).toEqual([0.5, 0.5]);
});
it("preserves fractional timing and quantizes from original ticks", () => {
  const bytes = file([121, 144, 60, 90, 119, 128, 60, 0, 0, 255, 47, 0]);
  const preserve = convertMidi(bytes, { mode: "PRESERVE" });
  const quantized = convertMidi(bytes, { mode: "QUANTIZE", grid: "1/2" });
  expect(quantized.changedNoteCount).toBe(1);
  expect(convertMidi(bytes, { mode: "PRESERVE" }).candidate).toEqual(
    preserve.candidate,
  );
});
