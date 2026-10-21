import { z } from "zod";
import * as Core from "../core";
import { keyAccidentalSchema } from "../core/key-accidental";
import "../core/extensions/to-sheet";
import { sheetScoreSchema } from "./score-schema";
import type { ConversionIssue } from "./contracts";
const beat = z.number().finite().nonnegative();
const event = {
  start: beat.optional(),
  duration: beat.optional(),
  end: beat.optional(),
};
const coreNote = z
  .object({
    ...event,
    id: z.int().nonnegative().optional(),
    pitch: z.int().min(0).max(127),
    velocity: z.int().min(0).max(127).optional(),
    channel: z.int().min(0).max(15).optional(),
  })
  .strict()
  .superRefine((note, context) => {
    const start =
      note.start ??
      (note.end !== undefined && note.duration !== undefined
        ? note.end - note.duration
        : 0);
    const duration =
      note.duration ?? (note.end === undefined ? undefined : note.end - start);
    if (
      start < 0 ||
      duration === undefined ||
      duration <= 0 ||
      (note.end !== undefined && Math.abs(start + duration - note.end) > 1e-9)
    )
      context.addIssue({
        code: "custom",
        message: "Missing or inconsistent note duration",
      });
  });
const coreSchema = z
  .object({
    name: z.string().optional(),
    tracks: z
      .array(
        z
          .object({
            name: z.string().optional(),
            preset: z.int().min(0).max(127).optional(),
            sourceTrack: z.int().nonnegative().optional(),
            notes: z.array(coreNote).min(1),
          })
          .strict(),
      )
      .min(1),
    tempos: z
      .array(
        z.object({ ...event, value: z.number().finite().positive() }).strict(),
      )
      .optional(),
    timesignatures: z
      .array(
        z
          .object({
            ...event,
            numerator: z.int().positive(),
            denominator: z
              .int()
              .positive()
              .refine((value) => Number.isInteger(Math.log2(value))),
          })
          .strict(),
      )
      .optional(),
    keysignatures: z
      .array(
        z
          .object({
            ...event,
            accidental: keyAccidentalSchema,
            tonality: z.union([z.literal(0), z.literal(1)]),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();
export function convertJson(input: unknown) {
  // JSON transport removes unsupported values/prototypes before the musical schema check.
  const value = z.json().parse(input);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("INVALID_JSON_SCORE");
  const issues: ConversionIssue[] = [];
  if ("bars" in value || "staves" in value || "masterbars" in value) {
    if (
      Array.isArray(value.tracks) &&
      value.tracks.some(
        (track) => track && typeof track === "object" && "notes" in track,
      )
    )
      throw new Error("MIXED_JSON_SCORE");
    return {
      format: "SHEET_JSON" as const,
      candidate: sheetScoreSchema.parse(structuredClone(value)),
      issues,
    };
  }
  const parameters = coreSchema.parse(structuredClone(value));
  const count = parameters.tracks.reduce(
    (total, track) => total + track.notes.length,
    0,
  );
  if (count > 10_000) throw new Error("NOTE_LIMIT");
  // Bound the generated number of bars before calling a notation converter.
  const maxEnd = Math.max(
    ...parameters.tracks.flatMap((track) =>
      track.notes.map(
        (note) => note.end ?? (note.start ?? 0) + (note.duration ?? 0),
      ),
    ),
  );
  if (maxEnd > 40_000) throw new Error("SCORE_SPAN_LIMIT");
  function normalize<T extends { start?: number }>(
    events: T[] | undefined,
    fallback: T,
    key: string,
    message: string,
  ) {
    const byTime = new Map<number, T>();
    for (const event of events ?? []) {
      const time = event.start ?? 0;
      if (time > maxEnd) {
        issues.push({
          id: `outside:${key}:${time}:${issues.length}`,
          code: "METADATA_AFTER_SCORE_END",
          severity: "WARNING",
          status: "UNRESOLVED",
          message: "演奏区間より後の演奏設定を除外しました。",
        });
        continue;
      }
      const previous = byTime.get(time);
      if (previous && JSON.stringify(previous) !== JSON.stringify(event))
        issues.push({
          id: `conflict:${key}:${time}:${issues.length}`,
          code: "CONFLICTING_METADATA",
          severity: "BLOCKING",
          status: "UNRESOLVED",
          message: "同じ時刻に異なる演奏設定が指定されています。",
        });
      byTime.set(time, event);
    }
    if (!byTime.has(0)) {
      byTime.set(0, fallback);
      issues.push({
        id: `default:${key}`,
        code: `DEFAULT_${key.toUpperCase()}`,
        severity: "WARNING",
        status: "UNRESOLVED",
        message,
      });
    }
    return [...byTime.values()].toSorted(
      (a, b) => (a.start ?? 0) - (b.start ?? 0),
    );
  }
  parameters.tempos = normalize(
    parameters.tempos,
    { start: 0, value: 120 },
    "tempos",
    "開始位置のテンポ未指定のため120 BPMを補完しました。",
  );
  parameters.timesignatures = normalize(
    parameters.timesignatures,
    { start: 0, numerator: 4, denominator: 4 },
    "timesignatures",
    "開始位置の拍子未指定のため4/4を補完しました。",
  );
  parameters.keysignatures = normalize(
    parameters.keysignatures,
    { start: 0, accidental: 0, tonality: 0 },
    "keysignatures",
    "開始位置の調号未指定のためハ長調を補完しました。",
  );
  // Core.create mutates metadata bounds, so it receives only our private clone.
  const score = Core.Score.create(parameters);
  // Strip undefined optional fields to match the signed JSON transport.
  const candidate = sheetScoreSchema.parse(
    // eslint-disable-next-line unicorn/prefer-structured-clone
    JSON.parse(JSON.stringify(score.toSheet().export())),
  );
  return { format: "CORE_JSON" as const, candidate, issues };
}
