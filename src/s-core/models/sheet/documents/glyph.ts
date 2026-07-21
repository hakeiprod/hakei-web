import { ElementType } from "..";
import { Element } from "./element";

export class Glyph extends Element {
  get width(): number {
    console.log(this);
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
