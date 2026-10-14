import { z } from "zod";
import { Microseconds } from "../core/units/microseconds";
import { TimeOffset } from "../core/units/time-offset";
import { Conditions } from "./conditions";
import { Performance } from "./performance";
import { Timeline } from "./timeline";
import type { EvaluationRule, PracticeTimeline } from "./contracts";
import { analyzePractice } from "./analyze";
import { evaluateGame } from "./game-evaluation";
export type EvaluationContext =
  | { phase: "LIVE"; elapsedUs: TimeOffset }
  | { phase: "COMPLETED" | "INTERRUPTED"; endedUs: Microseconds };
/** Shared evaluation policy; device lifecycle and persistence belong to callers. */
export class Evaluator {
  private readonly rule: EvaluationRule;
  private readonly expectations: PracticeTimeline;
  private readonly window: Microseconds;
  private readonly duration: Microseconds;
  private readonly mode: "PRACTICE" | "GAME";
  constructor(
    timeline: Timeline,
    private readonly conditions: Conditions,
    rule: EvaluationRule,
  ) {
    this.expectations = timeline.export();
    this.rule = z
      .object({
        id: z.string(),
        version: z.int().positive(),
        practiceWindowUs: z.int().nonnegative(),
        perfectWindowUs: z.int().nonnegative(),
        goodWindowUs: z.int().nonnegative(),
      })
      .parse(rule);
    if (this.rule.goodWindowUs < this.rule.perfectWindowUs)
      throw new Error("INVALID_EVALUATION_INPUT");
    this.mode = conditions.export().mode;
    this.window = new Microseconds(
      this.mode === "GAME"
        ? this.rule.goodWindowUs
        : this.rule.practiceWindowUs,
    );
    this.duration = timeline.duration;
  }
  evaluate(performance: Performance, context: EvaluationContext) {
    const timeline = this.expectations;
    const windowUs = this.window.value;
    const matching = performance.match(
      timeline.notes,
      this.window,
      this.conditions.calibration,
      this.duration,
    );
    if (context.phase !== "COMPLETED") {
      const time =
        context.phase === "LIVE"
          ? context.elapsedUs.value
          : context.endedUs.value;
      for (const note of matching.perNote)
        if (note.status === "MISSED" && note.onsetUs + windowUs > time)
          note.status = "UNASSESSED";
    }
    return {
      matching,
      analysis: analyzePractice(
        matching,
        timeline.bars.length > 0 ? timeline.bars : undefined,
      ),
      game:
        this.mode === "GAME"
          ? evaluateGame(
              matching,
              this.rule.perfectWindowUs,
              this.rule.goodWindowUs,
            )
          : null,
    };
  }
}
