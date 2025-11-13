import * as Audio from "@/s-core/models/audio";
import * as Sheet from "@/s-core/models/sheet";
export class NoteHighlighter {
  constructor(public sheet: Sheet.Score) {}
  noteOn(note: Audio.Note) {
    this.sheet.notes
      .find(({ id, trackId }) => note.id === id && note.trackId === trackId)
      ?.ligature?.setStyle({ color: "red" });
  }
  noteOff(note: Audio.Note) {
    this.sheet.notes
      .find(({ id, trackId }) => note.id === id && note.trackId === trackId)
      ?.ligature?.setStyle({});
  }
}
