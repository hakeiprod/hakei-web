import { CSSProperties } from "react";
import { BoundingBox } from "../boundingbox";
import { Inset } from "../inset";
import { Ligature } from "./ligature";

export class Element {
  parent: Ligature | null = null;
  boundingBox = new BoundingBox(0, 0, 0, 0);
  inset = new Inset(0, 0, 0, 0);
  style: CSSProperties = {};
  onStyleChange?: (value: typeof this.style) => void;
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
  setStyle(value: typeof this.style) {
    this.style = value;
    this.onStyleChange?.(this.style);
  }
}
