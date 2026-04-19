import { BoundingBox } from "../boundingbox";
import { Inset } from "../inset";
import { Ligature } from "./ligature";
import { Word } from "./word";

export class Element {
  // TODO: Element | nullでよくね？
  parent: Ligature | Word | null = null;
  boundingBox = new BoundingBox(0, 0, 0, 0);
  inset = new Inset(0, 0, 0, 0);
  classList: string[] = [];
  onClassListChange?: (value: typeof this.classList) => void;
  get width() {
    return this.boundingBox.width + this.inset.left + this.inset.right;
  }
  get minWidth() {
    return this.boundingBox.width;
  }
  get height() {
    return this.boundingBox.height + this.inset.top + this.inset.bottom;
  }
  get right() {
    return this.width + this.boundingBox.x;
  }
  constructor(public attributes: Record<string, string> = {}) {}
  setClassName(
    value:
      | typeof this.classList
      | ((previouseValue: typeof this.classList) => typeof this.classList),
  ) {
    this.classList =
      typeof value === "function" ? value(this.classList) : value;
    this.onClassListChange?.(this.classList);
  }
}
