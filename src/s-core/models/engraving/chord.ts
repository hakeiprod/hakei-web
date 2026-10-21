import { firstBy, flat, map, pipe, prop } from "remeda";
import * as Engraving from "./";
import * as Sheet from "../sheet";
export class Chord extends Sheet.Chord {
  word = new Engraving.Word();
  noteheadsLigature = new Engraving.Ligature();
  legerlinesLigature = new Engraving.Ligature();
  override get width() {
    return this.word.width;
  }
  get noteheadOffset() {
    return this.notes.reduce(
      (sum, note) =>
        sum +
        note.accidentalGlyphs.reduce((width, glyph) => width + glyph.width, 0),
      0,
    );
  }
  override get legerlines() {
    if (this.stave.staffSettings?.kind === "tablature") return [];
    const notes = this.notes.filter((note) => !note.rest);
    if (notes.length === 0) return [];
    const minimum = Math.min(...notes.map((note) => note.line)),
      maximum = Math.max(...notes.map((note) => note.line));
    const lines: number[] = [];
    for (let line = 6; line <= Math.floor(maximum); line++) lines.push(line);
    for (let line = 0; line >= Math.ceil(minimum); line--) lines.push(line);
    return lines;
  }
  get notes() {
    return super.notes as Engraving.Note[];
  }
  get glyphAdvanceWidth() {
    return firstBy(this.notes, [prop("glyph", "glyphAdvanceWidth"), "desc"])!
      .glyph.glyphAdvanceWidth;
  }
  static import(data: ReturnType<Chord["export"]>) {
    return new Chord(super.import(data));
  }
  get height() {
    return pipe(
      this.notes,
      flat(),
      map((note) => ({
        top: note.line,
        bottom: note.line + note.glyph.height,
      })),
      (bounds) => {
        if (bounds.length === 0) return 0;
        const minY = Math.min(...bounds.map((b) => b.top));
        const maxY = Math.max(...bounds.map((b) => b.bottom));
        return maxY - minY;
      },
    );
  }
  get right() {
    return firstBy(this.notes, [prop("glyph", "right"), "desc"])!.glyph.right;
  }
  get left() {
    return firstBy(this.notes, [prop("glyph", "left"), "desc"])!.glyph.left;
  }
  draw() {
    this.word = new Engraving.Word();
    this.noteheadsLigature = new Engraving.Ligature();
    this.legerlinesLigature = new Engraving.Ligature();
    this.noteheadsLigature.append(this.notes.map(prop("glyph")));
    // Give accidentals their own columns, including parentheses. This conservatively
    // separates adjacent chord symbols rather than placing them on top of each other.
    for (const note of this.notes.toSorted((a, b) => a.line - b.line))
      for (const glyph of note.accidentalGlyphs) this.word.append([glyph]);
    this.word.append(
      [this.noteheadsLigature],
      this.notes.map(prop("dotLigature")),
    );
    this.legerlinesLigature.append(
      this.legerlines.map(
        (legerline) =>
          new Engraving.Glyph(
            "legerLine",
            Sheet.ElementType.LegerLine,
            legerline,
          ),
      ),
    );

    // Noteheads are rendered at their glyph advance offset. Keep ledger lines
    // on that same horizontal origin so their center sits under the notehead.
    for (const glyph of this.legerlinesLigature.glyphLists.flat()) {
      glyph.x = this.glyphAdvanceWidth;
    }
    // Local glyph positions are needed when measuring ink before row layout.
    this.word.order();
  }
}
