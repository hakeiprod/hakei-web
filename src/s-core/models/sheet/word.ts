import { firstBy, prop, reduce } from "remeda";
import { BoundingBox } from "../boundingbox";
import { Element } from "./element";
import { Glyph } from "./glyph";
import { Ligature } from "./ligature";

export class Word extends Element {
  public glyphOrLigatureLists: (Ligature | Glyph)[][] = [];
  get width() {
    return this.glyphOrLigatureLists.reduce(
      (accumulator, current) =>
        accumulator +
        (firstBy(current, [
          (glyphOrLigature) => glyphOrLigature.boundingBox,
          "desc",
        ])?.boundingBox.width ?? 0),
      0,
    );
  }
  get boundingBox() {
    return new BoundingBox(
      0,
      0,
      this.glyphOrLigatureLists.reduce(
        (accumulator, current) =>
          (firstBy(current, [
            (glyphOrLigature) => glyphOrLigature.boundingBox.width,
            "desc",
          ])?.boundingBox.width ?? 0) + accumulator,
        0,
      ),
      0,
    );
  }
  constructor() {
    super();
  }

  order() {
    reduce(
      this.glyphOrLigatureLists,
      (accumulator, current) => {
        for (const glyphOrLigature of current)
          if (glyphOrLigature instanceof Ligature) glyphOrLigature.order();
        if (accumulator)
          for (const glyphOrLigature of current) {
            const previousMaxWidthGlyph = firstBy(accumulator, [
              prop("boundingBox", "width"),
              "desc",
            ]);
            if (previousMaxWidthGlyph)
              glyphOrLigature.x = previousMaxWidthGlyph.edge.right;
          }
        return current;
      },
      null as Word["glyphOrLigatureLists"][number] | null,
    );
  }
  append(...glyphOrLigatures: Word["glyphOrLigatureLists"]) {
    this.glyphOrLigatureLists.push(...glyphOrLigatures);
    for (const elements of glyphOrLigatures)
      for (const element of elements) if (element) element.parent = this;
  }
}
