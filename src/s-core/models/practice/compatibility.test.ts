import { expect, it } from "vitest";
import fixture from "../../fixtures/practice/compatibility.json";
import { Conditions, Performance, Timeline, Evaluator } from "./index";
import { TimeOffset, Microseconds } from "../core/units";
for (const sample of fixture.cases) {
  it(`preserves fixed results for ${sample.phase} with calibration ${sample.conditions.calibrationUs}`, () => {
    const before = structuredClone(sample);
    const conditions = Conditions.import(sample.conditions);
    const model = Timeline.create(sample.score, conditions);
    const timeline = model.export();
    const context =
      sample.phase === "LIVE"
        ? { phase: "LIVE" as const, elapsedUs: new TimeOffset(sample.time) }
        : {
            phase:
              sample.phase === "COMPLETED"
                ? ("COMPLETED" as const)
                : ("INTERRUPTED" as const),
            endedUs: new Microseconds(sample.time),
          };
    const result = new Evaluator(model, conditions, fixture.rule).evaluate(
      Performance.import(sample.events),
      context,
    );
    const matches = result.matching;
    expect(timeline).toEqual(sample.timeline);
    expect(matches).toEqual(sample.matches);
    expect(result.analysis).toEqual(sample.analysis);
    expect(result.game).toEqual(sample.game);
    expect(sample).toEqual(before);
  });
}
