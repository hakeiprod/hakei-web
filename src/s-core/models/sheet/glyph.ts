import { ElementType } from ".";
import { Element } from "./element";

export class Glyph extends Element {
  get width() {
    return -1;
  }
  get height() {
    return -1;
  }
  constructor(
    public type: ElementType,
    public line?: number,
  ) {
    super();
  }
}
