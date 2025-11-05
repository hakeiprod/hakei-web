import * as Sheet from "../sheet";
import { Glyph } from "./glyph";
import { match } from "ts-pattern";
export class Timesignature extends Sheet.Timesignature {
  draw() {
    const handleLigature = (ligature: Sheet.Ligature) => {
      ligature.glyphLists = ligature.glyphLists.map((glyphs) =>
        glyphs.map((glyph) => {
          return glyph instanceof Sheet.Ligature
            ? handleLigature(glyph)
            : new Glyph(
                Glyph.find("timeSignatures", (v) =>
                  v.toLocaleLowerCase().includes(
                    match(glyph.type)
                      .with(Sheet.ElementType.Numerator, () => this.numerator)
                      .with(
                        Sheet.ElementType.Denominator,
                        () => this.denominator
                      )
                      .run()
                      .toString()
                  )
                ),
                glyph.type,
                glyph.line
              );
        })
      );
      return ligature;
    };
    super.draw();
    this.ligature = this.ligature ? handleLigature(this.ligature) : null;
  }
}
