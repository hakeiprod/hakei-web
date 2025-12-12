import { P, match } from "ts-pattern";
import * as Sheet from "../sheet";
import { Glyph } from "./glyph";
export class Timesignature extends Sheet.Timesignature {
  draw() {
    const handleLigature = (ligature: Sheet.Ligature) => {
      ligature.children = ligature.children.map((glyphs) =>
        glyphs.map((glyph) => {
          return match(glyph)
            .with(P.instanceOf(Sheet.Ligature), (glyph) =>
              handleLigature(glyph)
            )
            .with(
              P.instanceOf(Sheet.Glyph),
              (glyph) =>
                new Glyph(
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
                )
            )
            .run();
        })
      );
      return ligature;
    };
    super.draw();
    this.ligature = handleLigature(this.ligature);
  }
}
