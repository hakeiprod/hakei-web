import * as Engraving from "./";
import * as Sheet from "../sheet";

export class Row extends Sheet.Row {
  declare score: Engraving.Score;
  override get masterbars() {
    return super.masterbars as Engraving.Masterbar[];
  }
}
