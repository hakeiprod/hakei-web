import { Edge } from "./edge";

export class BoundingBox {
  constructor(
    public x: number,
    public y: number,
    public width: number,
    public height: number,
  ) {}
  toInset() {
    return new Edge(this.y, this.x + this.width, this.y + this.height, this.x);
  }
}
