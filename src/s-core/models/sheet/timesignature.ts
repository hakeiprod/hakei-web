import { ElementType } from ".";
import * as Core from "../core";
import { Glyph } from "./documents/glyph";
import { Ligature } from "./documents/ligature";

export class Timesignature extends Core.Timesignature {
  ligature = new Ligature();
  static import(data: ReturnType<Timesignature["export"]>) {
    return new Timesignature(super.import(data));
  }
  draw() {
    this.ligature.append([
      new Glyph(ElementType.Numerator, 4),
      new Glyph(ElementType.Denominator, 2),
    ]);
  }
}
