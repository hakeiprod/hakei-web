import { Row } from "./row";

export class Page {
  rows;
  constructor(rows: Row[]) {
    this.rows = rows;
  }
}
