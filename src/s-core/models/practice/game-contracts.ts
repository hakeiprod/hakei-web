import { z } from "zod";
const count = z.int().nonnegative();
export const gameEvaluationSchema = z.object({
  units: z.array(
    z.object({
      id: z.string(),
      onsetUs: count,
      trackId: count,
      noteIds: z.array(z.string()),
      judgment: z.enum(["PERFECT", "GOOD", "FAIL", "UNASSESSED"]),
      combo: count,
    }),
  ),
  expectedCount: count,
  perfectCount: count,
  goodCount: count,
  failedCount: count,
  extraCount: count,
  score: z.number().finite().min(0).max(100).nullable(),
  maxCombo: count,
  finalCombo: count,
});

export const gameSummarySchema = z.object({ game: gameEvaluationSchema });
