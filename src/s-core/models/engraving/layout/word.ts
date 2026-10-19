import { firstBy, reduce } from "remeda";
import type { LayoutGlyph } from "./glyph";
import { BoundingBox } from "../../boundingbox";
import { Element } from "./element";
import { Ligature } from "./ligature";

export class Word<Glyph extends LayoutGlyph = LayoutGlyph> extends Element {
  public glyphOrLigatureLists: (Ligature<Glyph> | Glyph)[][] = [];
  get width() {
    return this.glyphOrLigatureLists.reduce(
      (width, column) =>
        width +
        Math.max(0, ...column.map((element) => this.columnWidth(element))),
      0,
    );
  }
  private columnWidth(element: Ligature<Glyph> | Glyph) {
    // Glyph widths already include their advance; ligatures keep an outer gap.
    return (
      element.width + (element instanceof Ligature ? element.spaceLeft : 0)
    );
  }

  get height(): number {
    throw new Error("wip");
  }
  get boundingBox() {
    return new BoundingBox(0, 0, this.width, 0);
  }
  order() {
    reduce(
      this.glyphOrLigatureLists,
      (accumulator, current) => {
        for (const glyphOrLigature of current)
          if (glyphOrLigature instanceof Ligature) glyphOrLigature.order();
        for (const glyphOrLigature of current) {
          glyphOrLigature.x =
            glyphOrLigature instanceof Ligature ? glyphOrLigature.spaceLeft : 0;
          if (accumulator) {
            const previousMaxWidthGlyph = firstBy(accumulator, [
              (element) => element.right,
              "desc",
            ]);
            if (previousMaxWidthGlyph)
              glyphOrLigature.x += previousMaxWidthGlyph.right;
          }
        }
        return current;
      },
      null as Word["glyphOrLigatureLists"][number] | null,
    );
  }
  append(...glyphOrLigatures: (Ligature<Glyph> | Glyph)[][]) {
    this.glyphOrLigatureLists.push(...glyphOrLigatures);
    for (const elements of glyphOrLigatures)
      for (const element of elements) if (element) element.parent = this;
  }
}
