import { times } from "remeda";
import * as Engraving from ".";
import * as Sheet from "../../sheet";

export class Note extends Sheet.Note {
  declare score: Engraving.Score;
  declare glyph: Engraving.Glyph;
  declare dotLigature: Engraving.Ligature<Engraving.Glyph>;
  get stave() {
    return super.stave as Engraving.Stave;
  }
  get width() {
    return (
      this.glyph.width +
      (this.accidentalGlyph?.width ?? 0) +
      this.dotLigature.width
    );
  }
  accidentalGlyph?: Engraving.Glyph;
  draw() {
    const type = this.rest
      ? Sheet.ElementType.Rest
      : Sheet.ElementType.Notehead;
    this.glyph = new Engraving.Glyph(
      this.rest
        ? Engraving.Glyph.findRest(this.type)
        : Engraving.Glyph.findNotehead(this.type),
      type,
      this.line,
    );
    this.dotLigature = new Engraving.Ligature(
      times(this.dot, () => [
        new Engraving.Glyph(
          Engraving.Glyph.find("individualNotes", (v) => v.includes("Dot")),
          Sheet.ElementType.Dot,
          this.line,
        ),
      ]),
    );
  }
  static import(data: ReturnType<Note["export"]>) {
    return new Note(super.import(data));
  }
}
