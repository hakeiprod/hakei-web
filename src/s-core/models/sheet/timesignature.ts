import * as Core from "../core";
import { Ligature } from "./ligature";
import { Glyph } from "./glyph";
import { ElementType } from ".";

export class Timesignature extends Core.Timesignature {
  ligature: Ligature | null = null;
  draw() {
    this.ligature = new Ligature(
      [
        [
          new Glyph(ElementType.Numerator, 4),
          new Glyph(ElementType.Denominator, 2),
        ],
      ],
      0
    );
  }
}
