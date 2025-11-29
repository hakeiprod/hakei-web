import * as Core from "../core";
import { Ligature } from "./ligature";
import { Glyph } from "./glyph";
import { ElementType } from ".";

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
