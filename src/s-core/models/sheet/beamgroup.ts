import { first, last } from "remeda";
import * as Sheet from ".";
export class BeamGroup {
  level;
  notes;
  staveId;
  barId;
  trackId;
  score!: Sheet.Score;
  get firstNote() {
    return first(this.notes)!;
  }
  get lastNote() {
    return last(this.notes)!;
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
    notes,
    staveId,
    barId,
    trackId,
  }: {
    staveId: number;
    level: number;
    notes: Sheet.Note[];
    barId: number;
    trackId: number;
  }) {
    this.level = level;
    this.notes = notes;
    this.staveId = staveId;
    this.barId = barId;
    this.trackId = trackId;
  }
  calculateStemLength(note: Sheet.Note) {
    const x1 = this.firstNote.ligature.boundingBox.x;
    const x2 = this.lastNote.ligature.boundingBox.x;
    const y1 = this.firstNote.line;
    const y2 = this.lastNote.line;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const a = dy / dx;
    const b = y1 - a * x1;
    const beamY = a * note.ligature.boundingBox.x + b;
    return note.line - beamY;
  }
}
