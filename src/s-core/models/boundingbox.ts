import { Inset } from "./inset";

export class BoundingBox {
  constructor(
    public x: number,
    public y: number,
    public width: number,
    public height: number
  ) {}
  toInset() {
    return new Inset(this.y, this.x + this.width, this.y + this.height, this.x);
  }
}
