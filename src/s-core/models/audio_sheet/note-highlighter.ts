import { Controller } from "../browser/audio";
import * as Sheet from "../sheet";
export class NoteHighlighter {
  private frameId?: number;
  activeNotes = new Set<Sheet.Note>();
  constructor(
    public sheet: Sheet.Score,
    public controller: Controller,
  ) {}
  highlight() {
    this.stop();
    const loop = () => {
      const nextNotes = new Set<Sheet.Note>();
      for (const note of this.sheet.notes)
        if (
          this.controller.timer.elapsedSeconds.value >=
            note.start.toSeconds(note.tempo.value).value &&
          this.controller.timer.elapsedSeconds.value <=
            note.end.toSeconds(note.tempo.value).value
        )
          nextNotes.add(note);
      for (const note of this.activeNotes)
        if (!nextNotes.has(note)) note.glyph.setClassName([]);
      for (const note of nextNotes)
        if (!this.activeNotes.has(note))
          note.glyph.setClassName(["note-highlight"]);
      this.activeNotes = nextNotes;
      this.frameId = requestAnimationFrame(loop);
    };
    loop();
  }
  stop() {
    if (this.frameId !== undefined) cancelAnimationFrame(this.frameId);
    this.frameId = undefined;
    for (const note of this.activeNotes) note.glyph.setClassName([]);
    this.activeNotes.clear();
  }
}
