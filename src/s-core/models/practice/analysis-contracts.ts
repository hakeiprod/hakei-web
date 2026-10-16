import { z } from "zod";
const count = z.int().nonnegative(),
  summarySchema = z.object({
    expectedCount: count,
    correctCount: count,
    wrongCount: count,
    missedCount: count,
    extraCount: count,
    pitchAccuracy: z.number().finite().min(0).max(1).nullable(),
    meanAbsTimingUs: z.number().finite().nonnegative().nullable(),
  });
export const analysisSchema = z.object({
  summary: summarySchema,
  perNote: z.array(
    z.object({
      noteId: z.string(),
      barNumber: z.int().positive(),
      pitch: z.int().min(0).max(127),
      status: z.string(),
      deltaUs: z.number().finite().optional(),
      actualPitch: z.int().optional(),
    }),
  ),
  perBar: z.array(summarySchema.extend({ barNumber: z.int().positive() })),
});
