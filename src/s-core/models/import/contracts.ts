import { z } from "zod";
import {
  beamSchema,
  stemSchema,
  notatedTypeSchema,
  sheetScoreSchema,
} from "./score-schema";
import { midiConversionOptionsSchema } from "./quantize-midi";

export const conversionIssueSchema = z
  .object({
    id: z.string().min(1).max(200),
    code: z.string().min(1).max(100),
    severity: z.enum(["INFO", "WARNING", "BLOCKING"]),
    status: z.enum(["UNRESOLVED", "RESOLVED"]).default("UNRESOLVED"),
    fieldPath: z.string().max(500).optional(),
    track: z.int().nonnegative().optional(),
    bar: z.int().nonnegative().optional(),
    message: z.string().min(1).max(2000),
  })
  .strict();
export type ConversionIssue = z.infer<typeof conversionIssueSchema>;
const nonnegative = z.number().finite().nonnegative();
export const partialNoteSchema = z
  .object({
    id: z.string().min(1),
    trackId: z.int().nonnegative(),
    pitch: z.int().min(0).max(127).nullable(),
    onset: nonnegative.nullable(),
    duration: z.number().finite().positive().nullable(),
    velocity: z.int().min(0).max(127),
    channel: z.int().min(0).max(15).optional(),
    rest: z.boolean(),
    voice: z.int().nonnegative().optional(),
    staveId: z.int().nonnegative().optional(),
    chordId: z.int().nonnegative().optional(),
    ties: z.array(z.enum(["start", "stop"])).optional(),
    stem: stemSchema.optional(),
    beam: beamSchema.optional(),
    notatedType: notatedTypeSchema.optional(),
    notatedDots: z.int().min(0).max(4).optional(),
  })
  .strict();
export const partialScoreSchema = z
  .object({
    format: z.literal("converted-partial-v1"),
    notation: z.json().optional(),
    tracks: z.array(
      z
        .object({
          id: z.int().nonnegative(),
          name: z.string(),
          preset: z.int().min(0).max(127),
        })
        .strict(),
    ),
    notes: z.array(partialNoteSchema).max(10_000),
    tempos: z.array(
      z
        .object({ start: nonnegative, value: z.number().finite().positive() })
        .strict(),
    ),
    timesignatures: z.array(
      z
        .object({
          start: nonnegative,
          numerator: z.int().positive(),
          denominator: z.int().positive(),
        })
        .strict(),
    ),
    keysignatures: z.array(
      z
        .object({
          start: nonnegative,
          accidental: z.int().min(-7).max(7),
          tonality: z.union([z.literal(0), z.literal(1)]),
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((score, context) => {
    const tracks = new Set(score.tracks.map((track) => track.id));
    if (tracks.size !== score.tracks.length)
      context.addIssue({
        code: "custom",
        path: ["tracks"],
        message: "Duplicate track ID",
      });
    const ids = new Set<string>();
    for (const [index, note] of score.notes.entries()) {
      const id = `${note.trackId}:${note.id}`;
      if (ids.has(id) || !tracks.has(note.trackId))
        context.addIssue({
          code: "custom",
          path: ["notes", index],
          message: "Invalid note reference",
        });
      ids.add(id);
    }
  });
export const importCandidateSchema = z.union([
  partialScoreSchema,
  sheetScoreSchema,
]);
export const importMetadataSchema = z
  .object({
    format: z.enum(["MUSICXML", "MIDI", "CORE_JSON", "SHEET_JSON"]),
    formatVersion: z.string().min(1).max(50),
    converterVersion: z.string().min(1).max(100),
    options: midiConversionOptionsSchema,
    sourceName: z.string().max(255).optional(),
  })
  .strict();
export const revisionValidationSchema = z
  .object({
    validatorVersion: z.string(),
    canPractice: z.boolean(),
    canGame: z.boolean(),
    unresolvedIssueIds: z.array(z.string()),
  })
  .strict();
export type ImportCandidate = z.infer<typeof importCandidateSchema>;
export type ImportMetadata = z.infer<typeof importMetadataSchema>;
export type RevisionValidation = z.infer<typeof revisionValidationSchema>;
