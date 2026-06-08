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
import * as Sheet from "..";
import { Table } from "./table";

export class Ligature<
  Glyph extends Sheet.Glyph = Sheet.Glyph,
> extends Table<Glyph> {
  constructor(public glyphLists: Glyph[][] = []) {
    super();
  }
  get width(): number {
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
  append(...glyphLists: Glyph[][]) {
    this.glyphLists.push(...glyphLists);
    for (const elements of glyphLists)
      for (const element of elements) element.parent = this;
  }
}
