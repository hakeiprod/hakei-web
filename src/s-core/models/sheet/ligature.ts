import {
  filter,
  firstBy,
  identity,
  isTruthy,
  map,
  pipe,
  piped,
  prop,
  reduce,
} from "remeda";
import { BoundingBox } from "../boundingbox";
import { Edge } from "../edge";
import { Element } from "./element";
import { Glyph } from "./glyph";

export class Ligature extends Element {
  glyphLists: Glyph[][] = [];
  constructor(
    public line: number = 0,
    ...elementArguments: ConstructorParameters<typeof Element>
  ) {
    super(...elementArguments);
  }
  get boundingBox() {
    return new BoundingBox(
      0,
      0,
      pipe(
        this.glyphLists,
        map(
          piped(
            map(prop("boundingBox", "width")),
            firstBy([identity(), "desc"]),
          ),
        ),
        filter(isTruthy),
        reduce((accumulator, current) => accumulator + (current as number), 0),
      ),
      0,
    );
  }
  get edge() {
    return new Edge(
      this.boundingBox.y,
      this.boundingBox.width + this.x,
      this.boundingBox.height,
      this.boundingBox.x,
    );
  }
  order() {
    reduce(
      this.glyphLists,
      (accumulator, current) => {
        if (accumulator)
          for (const glyph of current) {
            const previousMaxWidthGlyph = firstBy(accumulator, [
              (glyph) => glyph.boundingBox.width,
              "desc",
            ]);
            if (previousMaxWidthGlyph)
              glyph.x = previousMaxWidthGlyph.edge.right;
          }
        return current;
      },
      null as Ligature["glyphLists"][number] | null,
    );
    // const lastMaxWidthGlyph = firstBy(last(this.glyphLists) ?? [], [
    //   prop("boundingBox", "width"),
    //   "desc",
    // ]);
    // if (lastMaxWidthGlyph) this.boundingBox.width = lastMaxWidthGlyph.right;
  }
  append(...elementLists: Glyph[][]) {
    this.glyphLists.push(...elementLists);
    for (const elements of elementLists)
      for (const element of elements) element.parent = this;
  }
}
