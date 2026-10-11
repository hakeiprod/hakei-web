import * as Engraving from ".";
import * as Sheet from "../../sheet";

export class Track extends Sheet.Track {
  declare score: Engraving.Score;
  override get bars() {
    return super.bars as Engraving.Bar[];
  }
  override getMasterbarBars(masterbarId: number) {
    return super.getMasterbarBars(masterbarId) as Engraving.Bar[];
  }
  static import(data: ReturnType<Track["export"]>) {
    return new Track(super.import(data));
  }
}
