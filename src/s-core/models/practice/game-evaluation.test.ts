import { expect, it } from "vitest";
import { matchPerformance } from "./matching";
import { evaluateGame } from "./game-evaluation";
import type { ExpectedNote, PerformanceEvent } from "./contracts";
const note = (
  noteId: string,
  onsetUs = 1_000_000,
  pitch = 60,
): ExpectedNote => ({
  noteId,
  onsetUs,
  pitch,
  trackId: 0,
  barNumber: 1,
  durationUs: 500_000,
});
const event = (
  sequence: number,
  relativeUs: number,
  pitch = 60,
): PerformanceEvent => ({
  sequence,
  relativeUs,
  pitch,
  type: "NOTE_ON",
  channel: 0,
  velocity: 90,
});
function evaluate(notes: ExpectedNote[], events: PerformanceEvent[]) {
  return evaluateGame(
    matchPerformance(notes, events, 60_000, 0, 3_000_000),
    30_000,
    60_000,
  );
}
it("includes perfect/good boundaries and excludes a one-microsecond overflow", () => {
  for (const delta of [-30_000, 30_000])
    expect(evaluate([note("a")], [event(0, 1_000_000 + delta)]).score).toBe(
      100,
    );
  for (const delta of [-60_000, 60_000, 30_001])
    expect(evaluate([note("a")], [event(0, 1_000_000 + delta)]).score).toBe(50);
  expect(evaluate([note("a")], [event(0, 1_060_001)]).score).toBe(0);
});
it("uses the worst chord member and missing/wrong/extra notes fail the whole chord", () => {
  const chord = [note("a"), note("b", 1_000_000, 64)];
  expect(
    evaluate(chord, [event(0, 1_000_000), event(1, 1_040_000, 64)]).score,
  ).toBe(50);
  expect(evaluate(chord, [event(0, 1_000_000)]).score).toBe(0);
  const extra = evaluate(chord, [
    event(0, 1_000_000),
    event(1, 1_000_000, 64),
    event(2, 1_000_000, 67),
  ]);
  expect(extra.score).toBe(0);
  expect(extra.extraCount).toBe(1);
});
it("assigns an extra to its nearest chord, with earlier onset breaking ties", () => {
  const result = evaluate(
    [note("a", 1_000_000), note("b", 1_100_000)],
    [event(0, 1_000_000), event(1, 1_050_000, 67), event(2, 1_100_000)],
  );
  expect(result.units.map((unit) => unit.judgment)).toEqual([
    "FAIL",
    "PERFECT",
  ]);
  expect(result.finalCombo).toBe(1);
});
it("reconstructs chronological combo, processes same-time extras after successes and is deterministic", () => {
  const expected = [note("a", 1_000_000), note("b", 2_000_000)],
    events = [
      event(0, 1_000_000),
      event(1, 1_500_000, 67),
      event(2, 2_000_000),
    ];
  const result = evaluate(expected, events);
  expect(result.score).toBe(50);
  expect(result.maxCombo).toBe(1);
  expect(result.finalCombo).toBe(1);
  for (let index = 0; index < 3; index++)
    expect(evaluate(expected, events)).toEqual(result);
  expect(evaluate(expected, []).score).toBe(0);
  expect(
    evaluate(expected, [event(0, 1_000_000), event(1, 2_000_000)]).score,
  ).toBe(100);
});
