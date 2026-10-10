import { Row } from "./row";

/** Page dimensions and margins in staff spaces. */
export interface PageLayout {
  width: number;
  height: number;
  margin: number;
}

export class Page {
  rows;
  constructor(rows: Row[]) {
    this.rows = rows;
  }
}
