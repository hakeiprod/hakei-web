import { expect, it } from "vitest";
import { matchPerformance } from "./matching";
import { analyzePractice } from "./analyze";
import type { ExpectedNote, PerformanceEvent } from "./contracts";
const note = (id: string, onsetUs = 1_000_000, pitch = 60): ExpectedNote => ({
  noteId: id,
  trackId: 0,
  barNumber: 1,
  pitch,
  onsetUs,
  durationUs: 500_000,
});
const input = (
  sequence: number,
  relativeUs: number,
  pitch = 60,
): PerformanceEvent => ({
  sequence,
  type: "NOTE_ON",
  channel: 0,
  pitch,
  velocity: 90,
  relativeUs,
});
it("includes ±150ms exactly and excludes a one-microsecond overflow", () => {
  for (const delta of [-150_000, 150_000])
    expect(
      matchPerformance(
        [note("a")],
        [input(0, 1_000_000 + delta)],
        150_000,
        0,
        2_000_000,
      ).perNote[0].status,
    ).toBe("CORRECT");
  expect(
    matchPerformance([note("a")], [input(0, 1_150_001)], 150_000, 0, 2_000_000)
      .perNote[0].status,
  ).toBe("MISSED");
});
it("assigns correct pitches before wrong pitches and consumes each input once", () => {
  const result = matchPerformance(
    [note("a", 1_000_000, 60), note("b", 1_010_000, 62)],
    [input(0, 1_000_000, 62), input(1, 1_010_000, 60)],
    150_000,
    0,
    2_000_000,
  );
  expect(result.perNote.map((note) => [note.status, note.sequence])).toEqual([
    ["CORRECT", 1],
    ["CORRECT", 0],
  ]);
  expect(
    matchPerformance(
      [note("a"), note("b")],
      [input(0, 1_000_000)],
      150_000,
      0,
      2_000_000,
    ).perNote.map((note) => note.status),
  ).toEqual(["CORRECT", "MISSED"]);
});
it("breaks equal differences by earlier time and then sequence", () => {
  const result = matchPerformance(
    [note("a")],
    [input(0, 900_000), input(1, 900_000), input(2, 1_100_000)],
    150_000,
    0,
    2_000_000,
  );
  expect(result.perNote[0].sequence).toBe(0);
  expect(result.extras.map((event) => event.sequence)).toEqual([1, 2]);
});
it("subtracts positive calibration and keeps unmatched means null", () => {
  const matches = matchPerformance(
    [note("a")],
    [input(0, 1_050_000)],
    150_000,
    50_000,
    2_000_000,
  );
  expect(matches.perNote[0].deltaUs).toBe(0);
  const empty = analyzePractice(
    matchPerformance([], [], 150_000, 0, 1_000_000),
  );
  expect(empty.summary.pitchAccuracy).toBeNull();
  expect(empty.summary.meanAbsTimingUs).toBeNull();
});
it("keeps delayed final attacks whose calibrated time is inside the assessment range", () => {
  const result = matchPerformance(
    [note("last", 950_000)],
    [input(0, 1_250_000)],
    150_000,
    300_000,
    1_000_000,
  );
  expect(result.perNote[0]).toMatchObject({ status: "CORRECT", deltaUs: 0 });
});
