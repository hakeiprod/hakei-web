import { expect, it } from "vitest";
import fixture from "../../fixtures/practice/compatibility.json";
import { Conditions, Performance, Timeline, Evaluator } from "./index";
import { TimeOffset } from "../core/units/time-offset";
import { Microseconds } from "../core/units/microseconds";
for (const sample of fixture.cases)
  it(`evaluates ${sample.phase} with ${sample.conditions.calibrationUs}`, () => {
    const conditions = Conditions.import(sample.conditions);
    const timeline = Timeline.create(sample.score, conditions);
    const performance = Performance.import(sample.events);
    const before = performance.export();
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
    const result = new Evaluator(timeline, conditions, fixture.rule).evaluate(
      performance,
      context,
    );
    expect(result).toEqual({
      matching: sample.matches,
      analysis: sample.analysis,
      game: sample.game,
    });
    expect(performance.export()).toEqual(before);
    expect(timeline.export()).toEqual(sample.timeline);
  });
it("preserves the unassessed equality boundary and practice null game", () => {
  const sample = fixture.cases[0];
  const conditions = Conditions.import({
    ...sample.conditions,
    mode: "PRACTICE",
  });
  const timeline = Timeline.create(sample.score, conditions);
  const evaluator = new Evaluator(timeline, conditions, fixture.rule);
  const onset = timeline.notes[0].onsetUs;
  const window = fixture.rule.practiceWindowUs;
  const early = evaluator.evaluate(Performance.import([]), {
    phase: "LIVE",
    elapsedUs: new TimeOffset(onset + window - 1),
  });
  const at = evaluator.evaluate(Performance.import([]), {
    phase: "LIVE",
    elapsedUs: new TimeOffset(onset + window),
  });
  expect(early.matching.perNote[0].status).toBe("UNASSESSED");
  expect(at.matching.perNote[0].status).toBe("MISSED");
  expect(at.game).toBeNull();
});

it("roundtrips compiled expectations independently and rejects malformed snapshots", () => {
  const sample = fixture.cases[0];
  const source = structuredClone(sample.timeline);
  const timeline = Timeline.import(source);
  source.notes[0].pitch = 100;
  const exported = timeline.export();
  exported.notes[0].pitch = 101;
  expect(timeline.export()).toEqual(sample.timeline);
  expect(() =>
    Timeline.import({ ...sample.timeline, durationUs: 0 }),
  ).toThrow();
  expect(() =>
    Timeline.import({ ...sample.timeline, unexpected: true }),
  ).toThrow();
});
it("preserves original inputs when a caller changes matching results", () => {
  const sample = fixture.cases[0];
  const performance = Performance.import(sample.events);
  const result = new Evaluator(
    Timeline.create(sample.score, Conditions.import(sample.conditions)),
    Conditions.import(sample.conditions),
    fixture.rule,
  ).evaluate(performance, {
    phase: "COMPLETED",
    endedUs: new Microseconds(sample.timeline.durationUs),
  });
  for (const extra of result.matching.extras) extra.pitch = 1;
  expect(performance.export()).toEqual(sample.events);
});
