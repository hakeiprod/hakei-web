import { firstBy, prop } from "remeda";
import * as SMUFL from ".";
import * as Sheet from "../sheet";
export class Chord extends Sheet.Chord {
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
  }
}
