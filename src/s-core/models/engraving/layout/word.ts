import { drainSteps } from "../../sheet/render-steps";
import { firstBy } from "remeda";
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
    return drainSteps(this.orderSteps());
  }
  *orderSteps() {
    let previous: Word["glyphOrLigatureLists"][number] | null = null;
    for (const current of this.glyphOrLigatureLists) {
      for (const element of current) {
        if (element instanceof Ligature) yield* element.orderSteps();
        yield;
      }
      for (const element of current) {
        element.x = element instanceof Ligature ? element.spaceLeft : 0;
        if (previous) {
          const widest = firstBy(previous, [
            (element) => element.right,
            "desc",
          ]);
          if (widest) element.x += widest.right;
        }
        yield;
      }
      previous = current;
    }
  }
  append(...glyphOrLigatures: (Ligature<Glyph> | Glyph)[][]) {
    this.glyphOrLigatureLists.push(...glyphOrLigatures);
    for (const elements of glyphOrLigatures)
      for (const element of elements) if (element) element.parent = this;
  }
}
