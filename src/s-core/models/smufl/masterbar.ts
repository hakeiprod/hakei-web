import * as SMUFL from ".";
import * as Sheet from "../sheet";

export class Masterbar extends Sheet.Masterbar {
  declare score: SMUFL.Score;
  override get bars() {
    return super.bars as SMUFL.Bar[];
  }
  static import(data: ReturnType<Masterbar["export"]>) {
    return new Masterbar(super.import(data));
  }
}
