import type { ExpectedNote, PerformanceEvent } from "./contracts";
export interface MatchedNote extends ExpectedNote {
  status: "CORRECT" | "WRONG" | "MISSED" | "UNASSESSED";
  sequence?: number;
  actualPitch?: number;
  deltaUs?: number;
  correctedUs?: number;
}
export interface MatchedInput extends PerformanceEvent {
  correctedUs: number;
}
export interface MatchingResult {
  perNote: MatchedNote[];
  extras: MatchedInput[];
}
/** Sorted pools with successor/predecessor deletion avoid repeatedly scanning consumed inputs. */
class InputPool {
  private next: number[];
  private previous: number[];
  private indices: Map<number, number>;
  constructor(readonly values: MatchedInput[]) {
    this.next = Array.from({ length: values.length + 1 }, (_, index) => index);
    this.previous = Array.from(
      { length: values.length + 1 },
      (_, index) => index,
    );
    this.indices = new Map(
      values.map((event, index) => [event.sequence, index]),
    );
  }
  private free(parent: number[], index: number) {
    let root = index;
    while (parent[root] !== root) root = parent[root];
    while (parent[index] !== index) {
      const next = parent[index];
      parent[index] = root;
      index = next;
    }
    return root;
  }
  private lower(time: number) {
    let low = 0,
      high = this.values.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (this.values[mid].correctedUs < time) low = mid + 1;
      else high = mid;
    }
    return low;
  }
  remove(sequence: number) {
    const index = this.indices.get(sequence);
    if (index === undefined) return;
    this.next[index] = this.free(this.next, index + 1);
    this.previous[index + 1] = this.free(this.previous, index);
  }
  nearest(time: number, window: number) {
    const boundary = this.lower(time),
      right = this.free(this.next, boundary),
      left = this.free(this.previous, boundary) - 1;
    const leftFirst =
      left < 0
        ? -1
        : this.free(this.next, this.lower(this.values[left].correctedUs));
    const candidates = [leftFirst, right]
      .filter((index) => index >= 0 && index < this.values.length)
      .map((index) => this.values[index])
      .filter((event) => Math.abs(event.correctedUs - time) <= window);
    return candidates.toSorted(
      (a, b) =>
        Math.abs(a.correctedUs - time) - Math.abs(b.correctedUs - time) ||
        a.correctedUs - b.correctedUs ||
        a.sequence - b.sequence,
    )[0];
  }
}
export function matchPerformance(
  expected: readonly ExpectedNote[],
  events: readonly PerformanceEvent[],
  windowUs: number,
  calibrationUs: number,
  durationUs: number,
): MatchingResult {
  if (
    !Number.isSafeInteger(windowUs) ||
    windowUs < 0 ||
    !Number.isSafeInteger(calibrationUs) ||
    !Number.isSafeInteger(durationUs) ||
    durationUs < 0
  )
    throw new Error("INVALID_EVALUATION_INPUT");
  const inputs = events
    .filter(
      (event) =>
        event.type === "NOTE_ON" &&
        event.velocity > 0 &&
        event.relativeUs >= 0 &&
        event.relativeUs <= durationUs + windowUs + Math.max(0, calibrationUs),
    )
    .map((event) => ({
      ...event,
      correctedUs: event.relativeUs - calibrationUs,
    }))
    .toSorted(
      (a, b) => a.correctedUs - b.correctedUs || a.sequence - b.sequence,
    );
  if (new Set(inputs.map((event) => event.sequence)).size !== inputs.length)
    throw new Error("DUPLICATE_INPUT_SEQUENCE");
  const all = new InputPool(inputs),
    pitchPools = new Map<number, InputPool>();
  for (const pitch of new Set(inputs.map((event) => event.pitch)))
    pitchPools.set(
      pitch,
      new InputPool(inputs.filter((event) => event.pitch === pitch)),
    );
  const used = new Set<number>();
  const perNote: MatchedNote[] = expected
    .map((note) => ({ ...note, status: "MISSED" as const }))
    .toSorted(
      (a, b) =>
        a.onsetUs - b.onsetUs ||
        (a.noteId < b.noteId ? -1 : a.noteId > b.noteId ? 1 : 0),
    );
  function assign(
    note: MatchedNote,
    event: MatchedInput,
    status: "CORRECT" | "WRONG",
  ) {
    note.status = status;
    note.sequence = event.sequence;
    note.actualPitch = event.pitch;
    note.deltaUs = event.correctedUs - note.onsetUs;
    note.correctedUs = event.correctedUs;
    used.add(event.sequence);
    all.remove(event.sequence);
    pitchPools.get(event.pitch)?.remove(event.sequence);
  }
  for (const note of perNote) {
    const event = pitchPools.get(note.pitch)?.nearest(note.onsetUs, windowUs);
    if (event) assign(note, event, "CORRECT");
  }
  for (const note of perNote) {
    if (note.status !== "MISSED") continue;
    const event = all.nearest(note.onsetUs, windowUs);
    if (event) assign(note, event, "WRONG");
  }
  return {
    perNote,
    extras: inputs.filter(
      (event) =>
        !used.has(event.sequence) &&
        event.correctedUs >= 0 &&
        event.correctedUs <= durationUs + windowUs,
    ),
  };
}
