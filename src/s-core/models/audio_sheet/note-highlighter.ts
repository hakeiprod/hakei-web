import { Controller } from "../browser/audio";
import * as Engraving from "../engraving";
import type { RenderSteps } from "../sheet/render-steps";
export class NoteHighlighter {
  /** Prepare the existing idle timer state without waiting for the soundfont. */
  static *initialSteps(sheet: Engraving.Score): RenderSteps<void> {
    for (const note of sheet.notes) {
      if (
        0 >= note.start.toSeconds(note.tempo.value).value &&
        0 <= note.end.toSeconds(note.tempo.value).value
      )
        note.glyph.setClassName(["note-highlight"]);
      yield;
    }
  }
  private frameId?: number;
  activeNotes = new Set<Engraving.Note>();
  constructor(
    public sheet: Engraving.Score,
    public controller: Controller,
  ) {
    for (const note of sheet.notes)
      if (note.glyph.classList.includes("note-highlight"))
        this.activeNotes.add(note);
  }
  highlight(animate = true) {
    this.cancelFrame();
    let refresh = true;
    const loop = () => {
      const nextNotes = new Set<Engraving.Note>();
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
        if (refresh || !this.activeNotes.has(note))
          note.glyph.setClassName(["note-highlight"]);
      this.activeNotes = nextNotes;
      refresh = false;
      if (animate) this.frameId = requestAnimationFrame(loop);
    };
    loop();
  }
  private cancelFrame() {
    if (this.frameId !== undefined) cancelAnimationFrame(this.frameId);
    this.frameId = undefined;
  }
  stop({ preserveClasses = false }: { preserveClasses?: boolean } = {}) {
    this.cancelFrame();
    if (!preserveClasses) {
      for (const note of this.activeNotes) note.glyph.setClassName([]);
      this.activeNotes.clear();
    }
  }
}
