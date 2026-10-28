import { drainSteps, mapSteps, sortSteps } from "../render-steps";
import {
  accidentalAlter,
  type ExplicitAccidental,
  type NotatedPitch,
} from "./schema";
import { resolveTiesSteps, tieIdentity, type TieNote } from "./ties";
export interface AccidentalNote extends TieNote {
  notatedPitch?: NotatedPitch;
  explicitAccidental?: ExplicitAccidental;
}
export interface AccidentalDecision {
  kind?: ExplicitAccidental["kind"];
  parentheses: boolean;
  explicit: boolean;
  spelling: NotatedPitch;
}
const kinds = new Map<number, ExplicitAccidental["kind"]>(
  Object.entries(accidentalAlter).map(([kind, alter]) => [
    alter,
    kind as ExplicitAccidental["kind"],
  ]),
);
export function resolveAccidentals(
  notes: readonly AccidentalNote[],
  bars: readonly { id: number; start: number; end: number }[],
  keys: readonly { start: number; accidental: number }[],
) {
  return drainSteps(resolveAccidentalsSteps(notes, bars, keys));
}
export function* resolveAccidentalsSteps(
  notes: readonly AccidentalNote[],
  bars: readonly { id: number; start: number; end: number }[],
  keys: readonly { start: number; accidental: number }[],
) {
  const result = new Map<string, AccidentalDecision>();
  const state = new Map<string, number | null>();
  const tieNotes = yield* mapSteps(notes, function* (note) {
    yield;
    return { ...note, visualTies: undefined };
  });
  const ties = yield* resolveTiesSteps(tieNotes);
  const continuations = new Set(
    ties.relations.map((relation) => tieIdentity(relation.endNote)),
  );
  const ordered = yield* sortSteps(
    notes.filter((n) => !n.rest && n.notatedPitch),
    (a, b) =>
      a.start - b.start ||
      a.trackId - b.trackId ||
      String(a.id).localeCompare(String(b.id)),
  );
  const sortedKeys = keys.toSorted((a, b) => a.start - b.start);
  const sortedBars = bars.toSorted((a, b) => a.start - b.start);
  let keyIndex = 0,
    barIndex = 0;
  let index = 0;
  while (index < ordered.length) {
    yield;
    const start = ordered[index].start;
    const batch: AccidentalNote[] = [];
    while (
      index < ordered.length &&
      Math.abs(ordered[index].start - start) < 1e-9
    )
      batch.push(ordered[index++]);
    while (
      keyIndex + 1 < sortedKeys.length &&
      sortedKeys[keyIndex + 1].start <= start
    )
      keyIndex++;
    while (
      barIndex + 1 < sortedBars.length &&
      sortedBars[barIndex + 1].start <= start
    )
      barIndex++;
    const keySignature = sortedKeys[keyIndex] ?? { start: 0, accidental: 0 };
    const bar = sortedBars[barIndex];
    const groups = new Map<string, AccidentalNote[]>();
    for (const note of batch) {
      yield;
      const pitch = note.notatedPitch!;
      const key = `${note.trackId}:${note.staveId ?? 0}:${bar?.id ?? 0}:${keySignature.start}:${pitch.step}:${pitch.octave}`;
      const group = groups.get(key) ?? [];
      group.push(note);
      groups.set(key, group);
    }
    for (const [key, group] of groups) {
      const pitch = group[0].notatedPitch!;
      const signatureSteps =
        keySignature.accidental > 0
          ? ["F", "C", "G", "D", "A", "E", "B"]
          : ["B", "E", "A", "D", "G", "C", "F"];
      const baseline = signatureSteps
        .slice(0, Math.abs(keySignature.accidental))
        .includes(pitch.step)
        ? Math.sign(keySignature.accidental)
        : 0;
      const previous = state.has(key) ? state.get(key) : baseline;
      const changed = new Set(
        group
          .filter((n) => !continuations.has(tieIdentity(n)))
          .map((n) => n.notatedPitch!.alter),
      );
      const conflict =
        new Set(group.map((n) => n.notatedPitch!.alter)).size > 1;
      for (const note of group) {
        yield;
        const spelling = note.notatedPitch!;
        const explicit = note.explicitAccidental;
        const kind =
          explicit?.kind ??
          (continuations.has(tieIdentity(note))
            ? undefined
            : conflict || previous !== spelling.alter
              ? kinds.get(spelling.alter)
              : undefined);
        result.set(tieIdentity(note), {
          kind,
          parentheses: explicit?.parentheses ?? false,
          explicit: Boolean(explicit),
          spelling,
        });
      }
      if (conflict) state.set(key, null);
      else if (changed.size > 0) state.set(key, [...changed][0]);
    }
  }
  return result;
}
