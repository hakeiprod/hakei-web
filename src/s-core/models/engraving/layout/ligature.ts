import { drainSteps } from "../../sheet/render-steps";
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
import type { LayoutGlyph } from "./glyph";
import { Table } from "./table";

export class Ligature<
  Glyph extends LayoutGlyph = LayoutGlyph,
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
  order() {
    return drainSteps(this.orderSteps());
  }
  *orderSteps() {
    let previous: Ligature["glyphLists"][number] | null = null;
    for (const current of this.glyphLists) {
      if (previous)
        for (const glyph of current) {
          const widest = firstBy(previous, [(glyph) => glyph.width, "desc"]);
          if (widest) glyph.x = widest.right;
          yield;
        }
      previous = current;
      yield;
    }
  }
  append(...glyphLists: Glyph[][]) {
    this.glyphLists.push(...glyphLists);
    for (const elements of glyphLists)
      for (const element of elements) element.parent = this;
  }
}
