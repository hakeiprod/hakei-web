import "server-only";
import { z } from "zod";
import {
  importCandidateSchema,
  conversionIssueSchema,
  importMetadataSchema,
} from "@/s-core/models/import/contracts";
import { promotePartial } from "@/s-core/models/import/promote-partial";
import { validateCandidate } from "@/s-core/models/import/diagnostics";
import { signPreview, verifyPreview } from "./import-preview-token";
const index = z.int().nonnegative();
const correctionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("NOTE"),
      index,
      pitch: z.int().min(0).max(127).optional(),
      start: z.number().finite().nonnegative().optional(),
      duration: z.number().finite().positive().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("TEMPO"),
      index,
      value: z.number().finite().positive(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("METER"),
      index,
      numerator: z.int().positive(),
      denominator: z
        .int()
        .positive()
        .refine((value) => Number.isInteger(Math.log2(value))),
    })
    .strict(),
  z
    .object({
      kind: z.literal("KEY"),
      index,
      accidental: z.int().min(-7).max(7),
      tonality: z.union([z.literal(0), z.literal(1)]),
    })
    .strict(),
]);
const inputSchema = z
  .object({
    originalCandidate: importCandidateSchema,
    originalIssues: z.array(conversionIssueSchema),
    metadata: importMetadataSchema,
    previewToken: z.string().max(4096),
    corrections: z.array(correctionSchema).min(1).max(10_000),
  })
  .strict();
export function revalidateImport(
  actorId: string,
  raw: unknown,
  secret = process.env.IMPORT_PREVIEW_SECRET,
  now = Date.now(),
) {
  const input = inputSchema.parse(raw);
  const claims = verifyPreview(
    input.previewToken,
    actorId,
    {
      candidate: input.originalCandidate,
      issues: input.originalIssues,
      metadata: input.metadata,
    },
    secret,
    now,
  );
  let candidate = structuredClone(input.originalCandidate);
  for (const correction of input.corrections) {
    switch (correction.kind) {
      case "NOTE": {
        const note = candidate.notes[correction.index];
        if (!note) throw new Error("INVALID_CORRECTION");
        if (
          correction.pitch === undefined &&
          correction.start === undefined &&
          correction.duration === undefined
        )
          throw new Error("INVALID_CORRECTION");
        if (correction.pitch !== undefined) note.pitch = correction.pitch;
        if (correction.duration !== undefined)
          note.duration = correction.duration;
        if (correction.start !== undefined) {
          if ("onset" in note) note.onset = correction.start;
          else note.start = correction.start;
        }
        if (
          "end" in note &&
          "start" in note &&
          typeof note.start === "number" &&
          typeof note.duration === "number"
        )
          note.end = note.start + note.duration;

        break;
      }
      case "TEMPO": {
        const item = candidate.tempos[correction.index];
        if (!item) throw new Error("INVALID_CORRECTION");
        item.value = correction.value;

        break;
      }
      case "METER": {
        const item = candidate.timesignatures[correction.index];
        if (!item) throw new Error("INVALID_CORRECTION");
        item.numerator = correction.numerator;
        item.denominator = correction.denominator;

        break;
      }
      default: {
        const item = candidate.keysignatures[correction.index];
        if (!item) throw new Error("INVALID_CORRECTION");
        item.accidental = correction.accidental;
        item.tonality = correction.tonality;
      }
    }
  }
  const promoted = promotePartial(candidate);
  candidate = promoted.candidate;
  // Musical corrections only; source-dependent blockers remain until evidence resolves them.
  const validated = validateCandidate(candidate, [
    ...input.originalIssues,
    ...promoted.issues.filter(
      (issue) =>
        !input.originalIssues.some((original) => original.id === issue.id),
    ),
  ]);
  const payload = {
    candidate: validated.candidate,
    issues: validated.issues,
    metadata: input.metadata,
  };
  return {
    ...validated,
    metadata: input.metadata,
    previewToken: signPreview(actorId, payload, secret, now, claims.expiresAt),
  };
}
