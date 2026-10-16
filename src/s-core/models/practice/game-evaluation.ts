import type { MatchingResult, MatchedNote } from "./matching";
export type GameJudgment = "PERFECT" | "GOOD" | "FAIL" | "UNASSESSED";
export interface GameUnit {
  id: string;
  onsetUs: number;
  trackId: number;
  noteIds: string[];
  judgment: GameJudgment;
  combo: number;
}
export interface GameEvaluation {
  units: GameUnit[];
  expectedCount: number;
  perfectCount: number;
  goodCount: number;
  failedCount: number;
  extraCount: number;
  score: number | null;
  maxCombo: number;
  finalCombo: number;
}
export function evaluateGame(
  matches: MatchingResult,
  perfectWindowUs: number,
  goodWindowUs: number,
): GameEvaluation {
  if (
    !Number.isSafeInteger(perfectWindowUs) ||
    !Number.isSafeInteger(goodWindowUs) ||
    perfectWindowUs < 0 ||
    goodWindowUs < perfectWindowUs
  )
    throw new Error("INVALID_EVALUATION_INPUT");
  const groups = new Map<string, MatchedNote[]>();
  for (const note of matches.perNote) {
    const key = `${note.trackId}:${note.onsetUs}`,
      group = groups.get(key) ?? [];
    group.push(note);
    groups.set(key, group);
  }
  const units: GameUnit[] = [...groups]
    .map<GameUnit>(([id, notes]) => ({
      id,
      onsetUs: notes[0].onsetUs,
      trackId: notes[0].trackId,
      noteIds: notes.map((note) => note.noteId),
      judgment: notes.some((note) => note.status === "UNASSESSED")
        ? "UNASSESSED"
        : notes.some(
              (note) =>
                note.status !== "CORRECT" ||
                Math.abs(note.deltaUs ?? Infinity) > goodWindowUs,
            )
          ? "FAIL"
          : notes.some(
                (note) => Math.abs(note.deltaUs ?? Infinity) > perfectWindowUs,
              )
            ? "GOOD"
            : "PERFECT",
      combo: 0,
    }))
    .toSorted((a, b) => a.onsetUs - b.onsetUs || a.trackId - b.trackId);
  for (const extra of matches.extras) {
    let low = 0,
      high = units.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (units[middle].onsetUs < extra.correctedUs) low = middle + 1;
      else high = middle;
    }
    const nearest = [units[low - 1], units[low]]
      .filter((unit): unit is GameUnit => unit !== undefined)
      .toSorted(
        (a, b) =>
          Math.abs(a.onsetUs - extra.correctedUs) -
            Math.abs(b.onsetUs - extra.correctedUs) ||
          a.onsetUs - b.onsetUs ||
          a.trackId - b.trackId,
      )[0];
    if (
      nearest &&
      Math.abs(nearest.onsetUs - extra.correctedUs) <= goodWindowUs &&
      nearest.judgment !== "UNASSESSED"
    )
      nearest.judgment = "FAIL";
  }
  let perfectCount = 0,
    goodCount = 0,
    failedCount = 0,
    maxCombo = 0,
    combo = 0;
  const ordered = [
    ...units.map((unit, index) => ({
      time: unit.onsetUs,
      kind: 0,
      index,
      unit,
    })),
    ...matches.extras.map((extra) => ({
      time: extra.correctedUs,
      kind: 1,
      index: extra.sequence,
      unit: null,
    })),
  ].toSorted((a, b) => a.time - b.time || a.kind - b.kind || a.index - b.index);
  for (const entry of ordered) {
    const unit = entry.unit;
    if (!unit) {
      combo = 0;
      continue;
    }
    if (unit.judgment === "UNASSESSED") continue;
    if (unit.judgment === "PERFECT") {
      perfectCount += unit.noteIds.length;
      combo++;
    } else if (unit.judgment === "GOOD") {
      goodCount += unit.noteIds.length;
      combo++;
    } else {
      failedCount += unit.noteIds.length;
      combo = 0;
    }
    unit.combo = combo;
    maxCombo = Math.max(maxCombo, combo);
  }
  const expectedCount = matches.perNote.length,
    extraCount = matches.extras.length;
  return {
    units,
    expectedCount,
    perfectCount,
    goodCount,
    failedCount,
    extraCount,
    score:
      expectedCount === 0
        ? null
        : Math.max(
            0,
            Math.min(
              100,
              (100 * (perfectCount + 0.5 * goodCount - extraCount)) /
                expectedCount,
            ),
          ),
    maxCombo,
    finalCombo: combo,
  };
}
