import { firstBy, last, prop, reduce } from "remeda";
import { Glyph } from "./glyph";
import { Ligature } from "./ligature";

export class Word {
  public glyphOrLigatureLists: (Ligature | Glyph)[][] = [];
  get width() {
    return this.glyphOrLigatureLists.reduce(
      (accumulator, current) =>
        accumulator + (firstBy(current, [prop("width"), "desc"])?.width ?? 0),
      0,
    );
  }
  constructor() {}

  order() {
    reduce(
      this.glyphOrLigatureLists,
      (accumulator, current) => {
        for (const glyphOrLigature of current)
          if (glyphOrLigature instanceof Ligature) glyphOrLigature.order();
        if (accumulator)
          for (const glyph of current) {
            const previousMaxWidthGlyph = firstBy(accumulator, [
              prop("width"),
              "desc",
            ]);
            if (previousMaxWidthGlyph)
              glyph.boundingBox.x = previousMaxWidthGlyph.right;
          }
        return current;
      },
      null as Word["glyphOrLigatureLists"][number] | null,
    );
    const lastMaxWidthGlyph = firstBy(last(this.glyphOrLigatureLists) ?? [], [
      prop("width"),
      "desc",
    ]);
    // if (lastMaxWidthGlyph) this.boundingBox.width = lastMaxWidthGlyph.right;
  }
  append(...glyphOrLigatures: Word["glyphOrLigatureLists"]) {
    this.glyphOrLigatureLists.push(...glyphOrLigatures);
    for (const elements of glyphOrLigatures)
      for (const element of elements) element.parent = this;
  }
}
