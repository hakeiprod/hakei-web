import * as Engraving from ".";
import * as Sheet from "../../sheet";

export class Masterbar extends Sheet.Masterbar {
  declare score: Engraving.Score;
  override get bars() {
    return super.bars as Engraving.Bar[];
  }

  static import(data: ReturnType<Masterbar["export"]>) {
    return new Masterbar(super.import(data));
  }
}
