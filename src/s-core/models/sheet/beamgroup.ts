import { first, last } from "remeda";
import { match } from "ts-pattern";
import * as Sheet from ".";
export class BeamGroup {
  level;
  chordIds;
  staveId;
  barId;
  trackId;
  score!: Sheet.Score;
  get firstChord() {
    return this.score.chords.find(
      (chord) => chord.id === first(this.chordIds),
    )!;
  }
  get lastChord() {
    return this.score.chords.find((chord) => chord.id === last(this.chordIds))!;
  }
  get stave() {
    return this.score.staves.find(
      (stave) =>
        stave.id === this.staveId &&
        stave.trackId === this.trackId &&
        stave.barId === this.barId,
    )!;
  }
  constructor({
    level,
    chordIds,
    staveId,
    barId,
    trackId,
  }: {
    staveId: number;
    level: number;
    chordIds: number[];
    barId: number;
    trackId: number;
  }) {
    this.level = level;
    this.chordIds = chordIds;
    this.staveId = staveId;
    this.barId = barId;
    this.trackId = trackId;
  }
  calculateStemLength(chord: Sheet.Chord) {
    const x1 = this.firstChord.stemX + this.firstChord.slot.x;
    const x2 = this.lastChord.stemX + this.lastChord.slot.x;
    const b = match(chord.stem?._ ?? "none")
      .with("up", () => 3)
      .with("down", () => -3)
      .with("double", () => {
        throw new Error("wip");
      })
      .with("none", () => 0)
      .exhaustive();
    const y1 = this.firstChord.line + b;
    const y2 = this.lastChord.line + b;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const m = dy / dx;
    return Math.abs(m * (chord.stemX + chord.slot.x - x1) + y1 - chord.line);
  }
}
