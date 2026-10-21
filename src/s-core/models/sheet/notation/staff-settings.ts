import { z } from "zod";
import { notatedPitchSchema, notationPitch } from "./schema";
export const staffSettingsSchema = z
  .object({
    kind: z.enum(["standard", "tablature", "percussion"]),
    lineCount: z.int().min(1).max(12),
    tuning: z
      .array(notatedPitchSchema.extend({ string: z.int().min(1).max(6) }))
      .max(6)
      .optional(),
  })
  .strict()
  .superRefine((s, c) => {
    if (
      (s.kind === "tablature" && ![4, 6].includes(s.lineCount)) ||
      (s.kind === "percussion" && s.lineCount !== 5)
    )
      c.addIssue({ code: "custom", message: "Unsupported staff line count" });
    const seen = new Set<number>();
    for (const t of s.tuning ?? []) {
      if (
        t.string > s.lineCount ||
        seen.has(t.string) ||
        notationPitch(t) < 0 ||
        notationPitch(t) > 127
      )
        c.addIssue({ code: "custom", message: "Invalid tuning" });
      seen.add(t.string);
    }
  });
export type StaffSettings = z.infer<typeof staffSettingsSchema>;
