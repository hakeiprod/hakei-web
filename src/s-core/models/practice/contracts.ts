import { z } from "zod";
export const practiceConditionsSchema = z
  .object({
    trackId: z.int().nonnegative(),
    rangeStartBar: z.int().positive(),
    rangeEndBar: z.int().positive(),
    tempoScale: z.number().finite().positive(),
    calibrationUs: z.int().min(-1_000_000).max(1_000_000),
    mode: z.enum(["PRACTICE", "GAME"]),
    ruleVersion: z.int().positive(),
  })
  .strict()
  .refine((value) => value.rangeEndBar >= value.rangeStartBar, {
    message: "Invalid bar range",
  });
export type PracticeConditions = z.infer<typeof practiceConditionsSchema>;
export const performanceEventSchema = z
  .object({
    sequence: z.int().nonnegative(),
    type: z.enum(["NOTE_ON", "NOTE_OFF"]),
    channel: z.int().min(0).max(15),
    pitch: z.int().min(0).max(127),
    velocity: z.int().min(0).max(127),
    relativeUs: z.int().nonnegative().max(1_801_200_000),
  })
  .strict()
  .refine((event) => event.type !== "NOTE_ON" || event.velocity > 0, {
    message: "Zero-velocity NOTE_ON must be normalized to NOTE_OFF",
  });
export const performanceEventsSchema = z
  .array(performanceEventSchema)
  .max(100_000)
  .superRefine((events, context) => {
    let sequence = -1,
      time = -1;
    for (const [index, event] of events.entries()) {
      if (event.sequence <= sequence || event.relativeUs < time)
        context.addIssue({
          code: "custom",
          path: [index],
          message:
            "Events must have unique increasing sequences and monotonic relative time",
        });
      sequence = event.sequence;
      time = event.relativeUs;
    }
  });
export type PerformanceEvent = z.infer<typeof performanceEventSchema>;
export interface EvaluationRule {
  id: string;
  version: number;
  practiceWindowUs: number;
  perfectWindowUs: number;
  goodWindowUs: number;
}
export interface ExpectedNote {
  noteId: string;
  trackId: number;
  barNumber: number;
  pitch: number;
  onsetUs: number;
  durationUs: number;
  chordId?: number;
}
export interface PracticeTimeline {
  bars: { barNumber: number; startUs: number; endUs: number }[];
  notes: ExpectedNote[];
  durationUs: number;
  rangeStartBeat: number;
  rangeEndBeat: number;
  continuations: {
    continuedFrom?: string;
    noteId: string;
    trackId: number;
    pitch: number;
    onsetUs: number;
    durationUs: number;
  }[];
}
