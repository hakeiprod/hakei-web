import type { Element } from "./element";

export class Page {
  readonly elements: readonly Element[];

  constructor(
    public readonly width: number,
    public readonly height: number,
    elements: readonly Element[] = [],
  ) {
    this.elements = [...elements];
  }
}
