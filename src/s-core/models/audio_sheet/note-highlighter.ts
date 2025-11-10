import * as Audio from "@/s-core/models/audio";
import * as Sheet from "@/s-core/models/sheet";
export class NoteHighlighter {
  constructor(audio: Audio.Score, sheet: Sheet.Score) {
    for (const note of audio.notes) {
      note.onNoteOn = () =>
        sheet.notes
          .find(({ id }) => note.id === id)
          ?.ligature?.setStyle({ color: "red" });
      note.onNoteOff = () =>
        sheet.notes.find(({ id }) => note.id === id)?.ligature?.setStyle({});
    }
  }
}
