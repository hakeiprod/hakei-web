import { Element, type ElementOptions } from "./element";
import type { Bounds, Point } from "./layout";

/** A font character at a resolved baseline position. */
export class Glyph extends Element {
  readonly kind = "glyph";
  readonly position: Readonly<Point>;
  readonly bounds: Readonly<Bounds>;

  constructor(
    public readonly codepoint: number,
    position: Point,
    bounds: Bounds,
    public readonly advanceWidth: number,
    options: ElementOptions & { glyphName?: string } = {},
  ) {
    super(options);
    this.position = { ...position };
    this.bounds = { ...bounds };
    this.glyphName = options.glyphName;
  }

  readonly glyphName?: string;
}
