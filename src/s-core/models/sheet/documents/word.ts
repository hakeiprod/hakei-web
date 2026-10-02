import { firstBy, reduce } from "remeda";
import * as Sheet from "..";
import { BoundingBox } from "../../boundingbox";
import { Element } from "./element";
import { Ligature } from "./ligature";

export class Word<Glyph extends Sheet.Glyph = Sheet.Glyph> extends Element {
  public glyphOrLigatureLists: (Ligature<Glyph> | Glyph)[][] = [];
  get width() {
    return this.glyphOrLigatureLists.reduce(
      (accumulator, current) =>
        accumulator +
        (firstBy(current, [(glyphOrLigature) => glyphOrLigature, "desc"])
          ?.width ?? 0),
      0,
    );
  }
  get height(): number {
    throw new Error("wip");
  }
  get boundingBox() {
    return new BoundingBox(
      0,
      0,
      this.glyphOrLigatureLists.reduce(
        (accumulator, current) =>
          (firstBy(current, [
            (glyphOrLigature) => glyphOrLigature.width,
            "desc",
          ])?.width ?? 0) + accumulator,
        0,
      ),
      0,
    );
  }
  order() {
    reduce(
      this.glyphOrLigatureLists,
      (accumulator, current) => {
        for (const glyphOrLigature of current)
          if (glyphOrLigature instanceof Ligature) glyphOrLigature.order();
        if (accumulator?.length) {
          const nextX = Math.max(
            ...accumulator.map((element) => element.right),
          );
          for (const glyphOrLigature of current) glyphOrLigature.x = nextX;
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
