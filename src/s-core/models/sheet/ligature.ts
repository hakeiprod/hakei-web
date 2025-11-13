import {
  filter,
  firstBy,
  identity,
  isTruthy,
  last,
  map,
  pipe,
  piped,
  prop,
  reduce,
} from "remeda";
import { Glyph } from "./glyph";
import { Element } from "./element";

export class Ligature<T extends Glyph = Glyph> extends Element {
  children: Element[][] = [];
  constructor(
    public line: number = 0,
    ...elementArguments: ConstructorParameters<typeof Element>
  ) {
    super(...elementArguments);
  }
  override get minWidth(): number {
    return pipe(
      this.children,
      map(piped(map(prop("minWidth")), firstBy([identity(), "desc"]))),
      filter(isTruthy),
      reduce((accumulator, current) => accumulator + (current as number), 0)
    );
  }
  order() {
    reduce(
      this.children,
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
      null as Ligature["children"][number] | null
    );
    const lastMaxWidthGlyph = firstBy(last(this.children) ?? [], [
      prop("width"),
      "desc",
    ]);
    if (lastMaxWidthGlyph) this.boundingBox.width = lastMaxWidthGlyph.right;
  }
  append(...elementLists: Element[][]) {
    this.children.push(...elementLists);
    for (const elements of elementLists)
      for (const element of elements) element.parent = this;
  }
}
