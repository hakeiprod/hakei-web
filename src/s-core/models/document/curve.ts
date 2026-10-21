import { Element } from "./element";
import type { Point, Bounds } from "./layout";
export interface TieMetadata {
  relationId: string;
  part: "complete" | "outgoing" | "incoming";
  startNote: { trackId: number; noteId: number };
  endNote: { trackId: number; noteId: number };
}
/** A closed cubic band in staff spaces; owns geometry, never score objects or DOM. */
export class Curve extends Element {
  readonly kind = "curve";
  readonly start: Point;
  readonly end: Point;
  readonly outer: readonly [Point, Point];
  readonly inner: readonly [Point, Point];
  readonly bounds: Bounds;
  readonly fill = "black";
  readonly relationId;
  readonly part;
  readonly startNote;
  readonly endNote;
  constructor(start: Point, end: Point, arch: number, metadata: TieMetadata) {
    super({ role: "tie" });
    if (
      ![start.x, start.y, end.x, end.y, arch].every(Number.isFinite) ||
      end.x <= start.x
    )
      throw new RangeError("Invalid tie geometry");
    this.start = { ...start };
    this.end = { ...end };
    const width = end.x - start.x;
    const thickness = Math.sign(arch || 1) * 0.12;
    this.outer = [
      { x: start.x + width / 3, y: start.y + arch },
      { x: end.x - width / 3, y: end.y + arch },
    ];
    this.inner = [
      { x: start.x + width / 3, y: start.y + arch - thickness },
      { x: end.x - width / 3, y: end.y + arch - thickness },
    ];
    const ys = [
      start.y,
      end.y,
      ...this.outer.map((p) => p.y),
      ...this.inner.map((p) => p.y),
    ];
    this.bounds = {
      x: start.x,
      y: Math.min(...ys),
      width,
      height: Math.max(...ys) - Math.min(...ys),
    };
    this.relationId = metadata.relationId;
    this.part = metadata.part;
    this.startNote = { ...metadata.startNote };
    this.endNote = { ...metadata.endNote };
  }
}
