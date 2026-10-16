import { z } from "zod";

export const midiConversionOptionsSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("PRESERVE") }).strict(),
  z
    .object({
      mode: z.literal("QUANTIZE"),
      grid: z.enum(["1/1", "1/2", "1/4", "1/8", "1/3", "1/6"]),
    })
    .strict(),
]);
export type MidiConversionOptions = z.infer<typeof midiConversionOptionsSchema>;
export interface MidiTickNote {
  id: string;
  onsetTicks: number;
  durationTicks: number;
}

/** Every invocation takes original ticks. No rounded result becomes a subsequent input. */
export function quantizeMidiNotes(
  input: readonly MidiTickNote[],
  ppqn: number,
  settings: MidiConversionOptions,
) {
  if (!Number.isSafeInteger(ppqn) || ppqn <= 0 || ppqn > 0x7f_ff)
    throw new Error("INVALID_PPQN");
  const options = midiConversionOptionsSchema.parse(settings);
  const issues: {
    noteId: string;
    code: "QUANTIZED_DURATION_CLAMPED";
    severity: "WARNING";
  }[] = [];
  const changes: {
    noteId: string;
    onsetDelta: number;
    durationDelta: number;
  }[] = [];
  const ids = new Set<string>();
  const denominator =
    options.mode === "QUANTIZE" ? Number(options.grid.split("/")[1]) : 1;
  function nearest(ticks: number) {
    const numerator = BigInt(ticks) * BigInt(denominator);
    const divisor = BigInt(ppqn);
    const quotient = numerator / divisor;
    const remainder = numerator % divisor;
    return quotient + (remainder * 2n > divisor ? 1n : 0n);
  }
  const notes = input.map((note) => {
    if (
      ids.has(note.id) ||
      !note.id ||
      !Number.isSafeInteger(note.onsetTicks) ||
      note.onsetTicks < 0 ||
      !Number.isSafeInteger(note.durationTicks) ||
      note.durationTicks <= 0
    )
      throw new Error("INVALID_MIDI_NOTE_TICKS");
    ids.add(note.id);
    const originalOnset = note.onsetTicks / ppqn;
    const originalDuration = note.durationTicks / ppqn;
    let onset = originalOnset;
    let duration = originalDuration;
    if (options.mode === "QUANTIZE") {
      const onsetGrid = nearest(note.onsetTicks);
      let durationGrid = nearest(note.durationTicks);
      if (durationGrid === 0n) {
        durationGrid = 1n;
        issues.push({
          noteId: note.id,
          code: "QUANTIZED_DURATION_CLAMPED",
          severity: "WARNING",
        });
      }
      onset = Number(onsetGrid) / denominator;
      duration = Number(durationGrid) / denominator;
      // Compare integer ratios rather than rounded Number values when counting changes.
      if (
        onsetGrid * BigInt(ppqn) !==
          BigInt(note.onsetTicks) * BigInt(denominator) ||
        durationGrid * BigInt(ppqn) !==
          BigInt(note.durationTicks) * BigInt(denominator)
      ) {
        changes.push({
          noteId: note.id,
          onsetDelta: onset - originalOnset,
          durationDelta: duration - originalDuration,
        });
      }
    }
    return { id: note.id, onset, duration, end: onset + duration };
  });
  return { notes, issues, changes, changedNoteCount: changes.length };
}
