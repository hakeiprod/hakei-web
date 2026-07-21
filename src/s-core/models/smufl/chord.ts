import { firstBy, map, pipe, prop } from "remeda";
import * as SMUFL from ".";
import * as Sheet from "../sheet";
export class Chord extends Sheet.Chord {
  declare legerlinesLigature: Sheet.Ligature<SMUFL.Glyph>;
  get notes() {
    return super.notes as SMUFL.Note[];
  }
  get glyphAdvanceWidth() {
    return firstBy(this.notes, [prop("glyph", "glyphAdvanceWidth"), "desc"])!
      .glyph.glyphAdvanceWidth;
  }
  static import(data: ReturnType<Chord["export"]>) {
    return new Chord(super.import(data));
  }
  draw() {
    super.draw();
    this.legerlinesLigature.glyphLists = pipe(
      this.legerlinesLigature.glyphLists,
      map(
        map(
          (glyph) =>
            new SMUFL.Glyph(
              SMUFL.Glyph.find("staves", (v) => v === "legerLine"),
              glyph.type,
              glyph.line,
            ),
        ),
      ),
    );
  }
}
