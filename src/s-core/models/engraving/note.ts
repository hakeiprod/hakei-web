import { fretRun } from "./notation/tablature";
import type { AccidentalDecision } from "../sheet/notation/accidentals";
import { times } from "remeda";
import * as Engraving from "./";
import * as Sheet from "../sheet";

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
      this.accidentalGlyphs.reduce((width, glyph) => width + glyph.width, 0) +
      this.dotLigature.width
    );
  }
  fretRun?: ReturnType<typeof fretRun>;
  accidentalGlyph?: Engraving.Glyph;
  accidentalDecision?: AccidentalDecision;
  accidentalGlyphs: Engraving.Glyph[] = [];
  draw() {
    this.fretRun = undefined;
    const decision =
      this.tablature || this.percussion ? undefined : this.accidentalDecision;
    this.accidentalGlyphs = [];
    this.accidentalGlyph = undefined;
    if (decision?.kind) {
      const names = {
        sharp: "accidentalSharp",
        flat: "accidentalFlat",
        natural: "accidentalNatural",
        "double-sharp": "accidentalDoubleSharp",
        "double-flat": "accidentalDoubleFlat",
      } as const;
      const glyph = new Engraving.Glyph(
        names[decision.kind],
        Sheet.ElementType.Accidental,
        this.line,
      );
      this.accidentalGlyph = glyph;
      this.accidentalGlyphs = decision.parentheses
        ? [
            new Engraving.Glyph(
              "accidentalParensLeft",
              Sheet.ElementType.Accidental,
              this.line,
            ),
            glyph,
            new Engraving.Glyph(
              "accidentalParensRight",
              Sheet.ElementType.Accidental,
              this.line,
            ),
          ]
        : [glyph];
    }
    const type = this.rest
      ? Sheet.ElementType.Rest
      : Sheet.ElementType.Notehead;
    this.glyph = new Engraving.Glyph(
      this.rest
        ? Engraving.Glyph.findRest(this.type)
        : this.percussion?.notehead === "x"
          ? this.type._ === "whole"
            ? "noteheadXWhole"
            : this.type._ === "half"
              ? "noteheadXHalf"
              : "noteheadXBlack"
          : Engraving.Glyph.findNotehead(this.type),
      type,
      this.line,
    );
    if (this.tablature && !this.rest) {
      this.fretRun = fretRun(this.tablature.fret, this.line);
      this.glyph.glyphBBox.x = 0;
      this.glyph.glyphBBox.y = this.fretRun.height / 2;
      this.glyph.glyphBBox.width = this.fretRun.width;
      this.glyph.glyphBBox.height = this.fretRun.height;
      this.glyph.glyphAdvanceWidth = this.fretRun.width;
      this.glyph.spaceLeft = 0.5;
    }
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
