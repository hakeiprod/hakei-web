import * as SMUFL from ".";
import * as Sheet from "../sheet";

export class Row extends Sheet.Row {
  declare score: SMUFL.Score;
  override get masterbars() {
    return super.masterbars as SMUFL.Masterbar[];
  }
}
