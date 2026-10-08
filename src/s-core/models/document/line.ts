import { Element, type ElementOptions } from "./element";
import type { Point } from "./layout";

export class Line extends Element {
  readonly kind = "line";
  readonly start: Readonly<Point>;
  readonly end: Readonly<Point>;

  constructor(
    start: Point,
    end: Point,
    public readonly strokeWidth: number,
    options: ElementOptions & { stroke?: string } = {},
  ) {
    super(options);
    this.start = { ...start };
    this.end = { ...end };
    this.stroke = options.stroke ?? "black";
  }

  readonly stroke: string;
}
