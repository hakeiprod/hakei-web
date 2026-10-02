import { match } from "ts-pattern";
import * as Sheet from "../sheet";
import { Glyph } from "./glyph";
export class Timesignature extends Sheet.Timesignature {
  static import(data: ReturnType<Timesignature["export"]>) {
    return new Timesignature(super.import(data));
  }
  draw() {
    super.draw();
    this.ligature.glyphLists = this.ligature.glyphLists.map((glyphs) =>
      glyphs.map((glyph) => {
        const value = match(glyph.type)
          .with(Sheet.ElementType.Numerator, () => this.numerator)
          .with(Sheet.ElementType.Denominator, () => this.denominator)
          .run();
        const glyphName = Glyph.find(
          "timeSignatures",
          (name) => name === `timeSig${value}`,
        );
        if (!glyphName)
          throw new RangeError(
            `Unsupported time signature component: ${value}`,
          );
        return new Glyph(glyphName, glyph.type, glyph.line);
      }),
    );
  }
}
