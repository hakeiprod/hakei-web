import { LayoutGlyph } from "./layout/glyph";
import { Ligature } from "./layout/ligature";
import { match } from "ts-pattern";
import * as Sheet from "../sheet";
import { Glyph } from "./glyph";
export class Timesignature extends Sheet.Timesignature {
  static import(data: ReturnType<Timesignature["export"]>) {
    return new Timesignature(super.import(data));
  }
  ligature = new Ligature();
  draw() {
    this.ligature = new Ligature();
    this.ligature.append([
      new LayoutGlyph(Sheet.ElementType.Numerator, 4),
      new LayoutGlyph(Sheet.ElementType.Denominator, 2),
    ]);
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
    // Numerator and denominator share a column, including their left advance.
    const glyphs = this.ligature.glyphLists.flat() as Glyph[];
    const advance = Math.max(...glyphs.map((glyph) => glyph.glyphAdvanceWidth));
    const width = Math.max(...glyphs.map((glyph) => glyph.glyphBBox.width));
    for (const glyph of glyphs)
      glyph.spaceLeft =
        advance + (width - glyph.glyphBBox.width) / 2 - glyph.glyphBBox.x;
  }
}
