import { BoundingBox } from "../../boundingbox";
import { Edge } from "../../edge";

export abstract class Element implements BoundingBox, Edge {
  x = 0;
  y = 0;
  spaceLeft = 0;
  abstract get width(): number;
  abstract get height(): number;
  get top() {
    return this.y;
  }
  get right() {
    return this.x + this.width;
  }
  get left() {
    return this.x;
  }
  get bottom() {
    return this.y + this.height;
  }
  parent: Element | null = null;
  classList: string[] = [];
  onClassListChange?: (value: typeof this.classList) => void;
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
