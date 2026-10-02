import { flat, map, pipe } from "remeda";
import * as Sheet from "..";
import { Table } from "./table";

export class Ligature<
  Glyph extends Sheet.Glyph = Sheet.Glyph,
> extends Table<Glyph> {
  constructor(public glyphLists: Glyph[][] = []) {
    super();
  }
  get height(): number {
    return pipe(
      this.glyphLists,
      flat(),
      map((glyph) => ({
        top: glyph.line,
        bottom: glyph.line + glyph.height,
      })),
      (bounds) => {
        if (bounds.length === 0) return 0;
        const minY = Math.min(...bounds.map((b) => b.top));
        const maxY = Math.max(...bounds.map((b) => b.bottom));
        return maxY - minY;
      },
    );
  }
  append(...glyphLists: Glyph[][]) {
    this.glyphLists.push(...glyphLists);
    for (const elements of glyphLists)
      for (const element of elements) element.parent = this;
  }
}
