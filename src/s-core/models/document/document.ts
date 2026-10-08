import type { Page } from "./page";

/** A renderer-independent snapshot. Page dimensions are in staff spaces. */
export class Document {
  readonly pages: readonly Page[];

  constructor(
    pages: readonly Page[],
    public readonly fontSize = 4,
  ) {
    this.pages = [...pages];
  }
}
