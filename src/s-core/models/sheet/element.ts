import { BoundingBox } from "../boundingbox";
import { Edge } from "../edge";

export abstract class Element {
  x = 0;
  y = 0;

  parent: Element | null = null;
  classList: string[] = [];
  get boundingBox() {
    return new BoundingBox(0, 0, 0, 0);
  }
  get edge() {
    return new Edge(0, 0, 0, 0);
  }
  onClassListChange?: (value: typeof this.classList) => void;
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
