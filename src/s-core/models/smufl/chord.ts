import { firstBy, prop } from "remeda";
import * as SMUFL from ".";
import * as Sheet from "../sheet";
export class Chord extends Sheet.Chord {
  get notes() {
    return super.notes as SMUFL.Note[];
  }
  get advancedWidth() {
    return (
      firstBy(this.notes, [prop("glyph"), "desc"])?.glyph.glyphAdvancedWidth ??
      0
    );
  }
  static import(data: ReturnType<Chord["export"]>) {
    return new Chord(super.import(data));
  }
  draw() {
    super.draw();
  }
}
