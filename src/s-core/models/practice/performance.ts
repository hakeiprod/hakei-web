import { Microseconds } from "../core/units/microseconds";
import { TimeOffset } from "../core/units/time-offset";
import type { ExpectedNote } from "./contracts";
import { matchPerformance } from "./matching";
import { performanceEventsSchema, type PerformanceEvent } from "./contracts";
/** Owns the original input sequence; unfinished notes remain original events. */
export class Performance {
  private constructor(private readonly events: readonly PerformanceEvent[]) {}
  static import(input: unknown) {
    return new Performance(performanceEventsSchema.parse(input));
  }
  /** Compare against expectations without exposing or copying the owned input sequence. */
  match(
    expected: readonly ExpectedNote[],
    window: Microseconds,
    calibration: TimeOffset,
    duration: Microseconds,
  ) {
    return matchPerformance(
      expected,
      this.events,
      window.value,
      calibration.value,
      duration.value,
    );
  }
  export() {
    return this.events.map((event) => ({ ...event }));
  }
}
