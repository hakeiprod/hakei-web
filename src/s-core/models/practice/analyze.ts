import type { MatchingResult } from "./matching";
export function analyzePractice(
  matching: MatchingResult,
  bars?: readonly { barNumber: number; startUs: number; endUs: number }[],
) {
  function summary(notes: MatchingResult["perNote"], extraCount: number) {
    const assessed = notes.filter((note) => note.status !== "UNASSESSED"),
      correct = assessed.filter((note) => note.status === "CORRECT").length,
      wrong = assessed.filter((note) => note.status === "WRONG").length,
      missed = assessed.filter((note) => note.status === "MISSED").length;
    const deltas = assessed.flatMap((note) =>
      note.deltaUs === undefined ? [] : [note.deltaUs],
    );
    return {
      expectedCount: assessed.length,
      correctCount: correct,
      wrongCount: wrong,
      missedCount: missed,
      extraCount,
      pitchAccuracy: assessed.length === 0 ? null : correct / assessed.length,
      meanAbsTimingUs:
        deltas.length === 0
          ? null
          : deltas.reduce((sum, value) => sum + Math.abs(value), 0) /
            deltas.length,
    };
  }
  const barNumbers =
    bars?.map((bar) => bar.barNumber) ??
    [...new Set(matching.perNote.map((note) => note.barNumber))].toSorted(
      (a, b) => a - b,
    );
  const perBar = barNumbers.map((barNumber) => {
    const bar = bars?.find((bar) => bar.barNumber === barNumber),
      last = bars?.at(-1);
    const extraCount = bar
      ? matching.extras.filter(
          (event) =>
            event.correctedUs >= bar.startUs &&
            (event.correctedUs < bar.endUs || bar === last),
        ).length
      : 0;
    return {
      barNumber,
      ...summary(
        matching.perNote.filter((note) => note.barNumber === barNumber),
        extraCount,
      ),
    };
  });
  return {
    summary: summary(matching.perNote, matching.extras.length),
    perNote: matching.perNote,
    perBar,
    extras: matching.extras,
  };
}
