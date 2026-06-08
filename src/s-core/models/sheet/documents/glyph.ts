import { ElementType } from "..";
import { Element } from "../element";

export class Glyph extends Element {
  get width(): number {
    throw new Error("unset");
  }
  get height(): number {
    throw new Error("unset");
  }
  constructor(
    public type: ElementType,
    public line: number,
  ) {
    super();
  }
}
