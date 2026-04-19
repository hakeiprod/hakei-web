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
      glyphs.map(
        (glyph) =>
          new Glyph(
            Glyph.find("timeSignatures", (v) =>
              v.toLocaleLowerCase().includes(
                match(glyph.type)
                  .with(Sheet.ElementType.Numerator, () => this.numerator)
                  .with(Sheet.ElementType.Denominator, () => this.denominator)
                  .run()
                  .toString(),
              ),
            ),
            glyph.type,
            glyph.line,
          ),
      ),
    );
  }
}
