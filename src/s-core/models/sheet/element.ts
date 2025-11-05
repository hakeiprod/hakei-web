import { BoundingBox } from "../boundingbox";
import { Inset } from "../inset";

export class Element {
  boundingBox = new BoundingBox(0, 0, 0, 0);
  inset = new Inset(0, 0, 0, 0);
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
}
