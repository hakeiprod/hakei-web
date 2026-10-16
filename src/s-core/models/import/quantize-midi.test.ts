import { describe, expect, it } from "vitest";
import { quantizeMidiNotes } from "./quantize-midi";

describe("MIDI rational quantization", () => {
  it("preserves original ticks and never mutates input", () => {
    const notes = [{ id: "a", onsetTicks: 121, durationTicks: 119 }];
    expect(
      quantizeMidiNotes(notes, 480, { mode: "PRESERVE" }).notes[0],
    ).toEqual({
      id: "a",
      onset: 121 / 480,
      duration: 119 / 480,
      end: 240 / 480,
    });
    expect(notes).toEqual([{ id: "a", onsetTicks: 121, durationTicks: 119 }]);
  });
  it("rounds onset and duration separately with ties toward the smaller value", () => {
    const result = quantizeMidiNotes(
      [{ id: "a", onsetTicks: 120, durationTicks: 360 }],
      480,
      { mode: "QUANTIZE", grid: "1/2" },
    );
    expect(result.notes[0]).toEqual({
      id: "a",
      onset: 0,
      duration: 0.5,
      end: 0.5,
    });
    expect(result.changedNoteCount).toBe(1);
  });
  it.each(["1/1", "1/2", "1/4", "1/8", "1/3", "1/6"] as const)(
    "supports %s and reports zero-duration correction",
    (grid) => {
      const result = quantizeMidiNotes(
        [{ id: "a", onsetTicks: 0, durationTicks: 1 }],
        960,
        { mode: "QUANTIZE", grid },
      );
      expect(result.notes[0].duration).toBe(1 / Number(grid.split("/")[1]));
      expect(result.issues).toEqual([
        {
          noteId: "a",
          code: "QUANTIZED_DURATION_CLAMPED",
          severity: "WARNING",
        },
      ]);
    },
  );
  it("compares large safe integers without floating point tie drift", () => {
    const result = quantizeMidiNotes(
      [{ id: "a", onsetTicks: Number.MAX_SAFE_INTEGER, durationTicks: 3 }],
      6,
      { mode: "QUANTIZE", grid: "1/3" },
    );
    expect(result.notes[0].onset).toBe(
      Number(BigInt(Number.MAX_SAFE_INTEGER) - 1n) / 6,
    );
    expect(result.notes[0].duration).toBe(1 / 3);
  });
  it("returns exactly the original preserve values after switching options", () => {
    const input = [{ id: "a", onsetTicks: 127, durationTicks: 111 }];
    const before = quantizeMidiNotes(input, 480, { mode: "PRESERVE" });
    quantizeMidiNotes(input, 480, { mode: "QUANTIZE", grid: "1/3" });
    expect(quantizeMidiNotes(input, 480, { mode: "PRESERVE" })).toEqual(before);
  });
  it("rejects invalid PPQN, negative ticks, and unknown grids", () => {
    const input = [{ id: "a", onsetTicks: 0, durationTicks: 1 }];
    expect(() => quantizeMidiNotes(input, 0, { mode: "PRESERVE" })).toThrow();
    expect(() =>
      quantizeMidiNotes([{ ...input[0], onsetTicks: -1 }], 480, {
        mode: "PRESERVE",
      }),
    ).toThrow();
    expect(() =>
      quantizeMidiNotes(input, 480, { mode: "QUANTIZE", grid: "1/5" } as never),
    ).toThrow();
  });
});
