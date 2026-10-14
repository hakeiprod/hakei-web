import { z } from "zod";
import { NonNegativeIntSchema, PositiveIntSchema } from "../validator";
export const notatedTypeSchema = z
  .object({
    _: z.enum([
      "1024th",
      "512th",
      "256th",
      "128th",
      "64th",
      "32nd",
      "16th",
      "eighth",
      "quarter",
      "half",
      "whole",
      "breve",
      "long",
      "maxima",
    ]),
  })
  .strict();
export const stemSchema = z
  .object({ _: z.enum(["up", "down", "none", "double"]) })
  .passthrough();
export const beamSchema = z
  .array(
    z
      .object({
        _: z.enum([
          "begin",
          "continue",
          "end",
          "forward hook",
          "backward hook",
        ]),
        $: z
          .object({ number: z.coerce.number().int().min(1).max(8).default(1) })
          .passthrough()
          .default({ number: 1 }),
      })
      .passthrough(),
  )
  .max(8);
const id = NonNegativeIntSchema;
const beat = z.number().finite().nonnegative();
const eventShape = { start: beat, duration: beat, end: beat };
const event = z.object(eventShape).passthrough();
const note = z
  .object({
    ...eventShape,
    id,
    trackId: id,
    staveId: id,
    chordId: id.optional(),
    pitch: id.max(127),
    velocity: id.max(127),
    channel: id.max(15).optional(),
    rest: z.boolean(),
    voice: id,
    ties: z.array(z.enum(["start", "stop"])).optional(),
    notatedType: notatedTypeSchema.optional(),
    notatedDots: z.int().min(0).max(4).optional(),
    stem: stemSchema.optional(),
    beam: beamSchema.optional(),
  })
  .passthrough();
// Older Sheet exports omit track duration; track bounds are derived from notes.
const track = z
  .object({
    ...eventShape,
    duration: beat.optional(),
    id,
    name: z.string(),
    preset: id.max(127),
    staffDetails: z.json(),
  })
  .passthrough();
/** Standard, fully specified Sheet export. Partial import candidates use a separate format. */
export const sheetScoreSchema = z
  .object({
    notes: z.array(note).max(10_000),
    tracks: z.array(track),
    timesignatures: z.array(
      event.extend({
        numerator: PositiveIntSchema,
        denominator: PositiveIntSchema.refine((value) =>
          Number.isInteger(Math.log2(value)),
        ),
      }),
    ),
    keysignatures: z.array(
      event.extend({
        accidental: z.int().min(-7).max(7),
        tonality: z.union([z.literal(0), z.literal(1)]),
      }),
    ),
    tempos: z.array(event.extend({ value: z.number().finite().positive() })),
    bars: z.array(z.object({ id, trackId: id }).passthrough()),
    masterbars: z.array(event.extend({ id })),
    staves: z.array(
      z
        .object({ id, trackId: id, barId: id, clefs: z.json().optional() })
        .passthrough(),
    ),
    chords: z.array(z.object({ id }).passthrough()),
    slots: z.array(z.json()),
    rows: z.array(z.json()),
  })
  .passthrough()
  .superRefine((score, context) => {
    const problem = (path: (string | number)[], message: string) =>
      context.addIssue({ code: "custom", path, message });
    if (score.notes.length > 0)
      for (const key of [
        "tempos",
        "timesignatures",
        "keysignatures",
      ] as const) {
        if (score[key].length === 0 || score[key][0].start !== 0)
          problem([key], "Missing initial musical metadata");
      }
    for (const key of ["tracks", "masterbars", "chords"] as const) {
      const ids = score[key].map((item) => item.id);
      if (new Set(ids).size !== ids.length) problem([key], "Duplicate ID");
    }
    const noteIds = new Set(
      score.notes.map((item) => `${item.trackId}:${item.id}`),
    );
    if (noteIds.size !== score.notes.length)
      problem(["notes"], "Duplicate track/note ID");
    const tracks = new Set(score.tracks.map((item) => item.id));
    const chords = new Set(score.chords.map((item) => item.id));
    const masterbars = new Set(score.masterbars.map((item) => item.id));
    const bars = new Set(
      score.bars.map((item) => `${item.trackId}:${item.id}`),
    );
    const staves = new Set(
      score.staves.map((item) => `${item.trackId}:${item.id}`),
    );
    if (bars.size !== score.bars.length)
      problem(["bars"], "Duplicate track/bar ID");
    const staveInstances = new Set(
      score.staves.map((item) => `${item.trackId}:${item.barId}:${item.id}`),
    );
    if (staveInstances.size !== score.staves.length)
      problem(["staves"], "Duplicate track/bar/stave ID");
    for (const key of [
      "notes",
      "tracks",
      "timesignatures",
      "keysignatures",
      "tempos",
      "masterbars",
    ] as const) {
      for (const [index, item] of score[key].entries()) {
        if (
          item.duration !== undefined &&
          Math.abs(item.start + item.duration - item.end) > 1e-9
        )
          problem([key, index], "Inconsistent event duration");
        if (
          key === "notes" &&
          item.duration !== undefined &&
          item.duration <= 0
        )
          problem([key, index, "duration"], "Note duration must be positive");
      }
    }
    for (const [index, item] of score.notes.entries()) {
      if (!tracks.has(item.trackId))
        problem(["notes", index, "trackId"], "Unknown track");
      if (!staves.has(`${item.trackId}:${item.staveId}`))
        problem(["notes", index, "staveId"], "Unknown stave");
      if (item.chordId !== undefined && !chords.has(item.chordId))
        problem(["notes", index, "chordId"], "Unknown chord");
    }
    for (const [index, item] of score.bars.entries()) {
      if (!tracks.has(item.trackId) || !masterbars.has(item.id))
        problem(["bars", index], "Unknown track/masterbar");
    }
    for (const [index, item] of score.staves.entries()) {
      if (!bars.has(`${item.trackId}:${item.barId}`))
        problem(["staves", index], "Unknown bar");
    }
  });
export type SheetScoreJson = z.infer<typeof sheetScoreSchema>;
