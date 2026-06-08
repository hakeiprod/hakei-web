import {
  filter,
  firstBy,
  identity,
  isTruthy,
  map,
  pipe,
  piped,
  reduce,
} from "remeda";
import { Element } from "../element";

export class Table<T extends Element> extends Element {
  constructor(public glyphLists: T[][] = []) {
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
    throw new Error("unset");
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
      null as Table<T>["glyphLists"][number] | null,
    );
  }
  append(...glyphLists: T[][]) {
    this.glyphLists.push(...glyphLists);
    for (const elements of glyphLists)
      for (const element of elements) element.parent = this;
  }
}
