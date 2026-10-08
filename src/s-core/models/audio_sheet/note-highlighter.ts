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
    const tempoMap = this.sheet.tempoMap;
    const loop = () => {
      const elapsed = this.controller.timer.elapsedSeconds.value;
      const nextNotes = new Set<Sheet.Note>();
      for (const note of this.sheet.notes)
        if (
          elapsed >= tempoMap.beatToSeconds(note.start).value &&
          elapsed <= tempoMap.beatToSeconds(note.end).value
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
