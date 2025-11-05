import * as Sheet from "../sheet";
import * as SMUFL from ".";

export class Row extends Sheet.Row {
  declare score: SMUFL.Score;
  override get masterbars() {
    return super.masterbars as SMUFL.Masterbar[];
  }
}
