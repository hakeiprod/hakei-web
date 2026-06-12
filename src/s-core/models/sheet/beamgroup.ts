import { first, last } from "remeda";
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
  calculateStemLength(note: Sheet.Note) {
    const x1 = this.firstChord.noteheadsLigature.x;
    const x2 = this.lastChord.noteheadsLigature.x;
    const y1 = this.firstChord.line;
    const y2 = this.lastChord.line;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const m = dy / dx;
    const beamY = m * (note.ligature.x - x1) + y1;
    return (note.stem?._ === "up" ? beamY - note.line : note.line - beamY) + 3;
  }
}
