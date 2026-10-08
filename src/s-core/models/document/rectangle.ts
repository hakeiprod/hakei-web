import { Element, type ElementOptions } from "./element";
import type { Bounds } from "./layout";

export class Rectangle extends Element {
  readonly kind = "rectangle";
  readonly bounds: Readonly<Bounds>;

  constructor(
    bounds: Bounds,
    public readonly stroke: string,
    public readonly strokeWidth: number,
    options: ElementOptions & { label?: string } = {},
  ) {
    super(options);
    this.bounds = { ...bounds };
    this.label = options.label;
  }

  readonly label?: string;
}
