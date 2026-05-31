import {
  filter,
  firstBy,
  flat,
  identity,
  isTruthy,
  map,
  pipe,
  piped,
  reduce,
} from "remeda";
import * as Sheet from ".";
import { Element } from "./element";

export class Ligature<Glyph extends Sheet.Glyph = Sheet.Glyph> extends Element {
  glyphLists: Glyph[][] = [];
  constructor(public line?: number) {
    super();
  }
  get width() {
    return pipe(
      this.glyphLists,
      map(
        piped(
          map((glyph) => glyph.width),
          firstBy([identity(), "desc"]),
        ),
      ),
      filter(isTruthy),
      reduce((accumulator, current) => accumulator + (current as number), 0),
    );
  }
  get height(): number {
    return pipe(
      this.glyphLists,
      flat(),
      map((glyph) => ({
        top: glyph.line ?? 0,
        bottom: (glyph.line ?? 0) + glyph.height,
      })),
      (bounds) => {
        if (bounds.length === 0) return 0;
        const minY = Math.min(...bounds.map((b) => b.top));
        const maxY = Math.max(...bounds.map((b) => b.bottom));
        return maxY - minY;
      },
    );
  }
  order() {
    reduce(
      this.glyphLists,
      (accumulator, current) => {
        if (accumulator)
          for (const glyph of current) {
            const previousMaxWidthGlyph = firstBy(accumulator, [
              (glyph) => glyph.width,
              "desc",
            ]);
            if (previousMaxWidthGlyph) glyph.x = previousMaxWidthGlyph.right;
          }
        return current;
      },
      null as Ligature["glyphLists"][number] | null,
    );
  }
  append(...elementLists: Glyph[][]) {
    this.glyphLists.push(...elementLists);
    for (const elements of elementLists)
      for (const element of elements) element.parent = this;
  }
}
