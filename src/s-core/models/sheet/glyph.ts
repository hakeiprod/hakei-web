import { ElementType } from ".";
import { Element } from "./element";

export class Glyph extends Element {
  constructor(
    public type: ElementType,
    public line: number = 0,
    ...element: ConstructorParameters<typeof Element>
  ) {
    super(...element);
  }
}
