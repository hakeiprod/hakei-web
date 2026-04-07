import * as Audio from "../audio";
import * as Sheet from "../sheet";
export class NoteHighlighter {
  constructor(public sheet: Sheet.Score) {}
  noteOn(note: Audio.Note) {
    this.sheet.notes
      .find(({ id, trackId }) => note.id === id && note.trackId === trackId)
      ?.ligature?.setClassName(["note-highlight"]);
  }
  noteOff(note: Audio.Note) {
    this.sheet.notes
      .find(({ id, trackId }) => note.id === id && note.trackId === trackId)
      ?.ligature?.setClassName([]);
  }
  reset() {
    for (const note of this.sheet.notes) {
      note.ligature?.setClassName([]);
    }
  }
}
