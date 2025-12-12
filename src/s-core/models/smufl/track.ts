import * as SMUFL from ".";
import * as Sheet from "../sheet";

export class Track extends Sheet.Track {
  declare score: SMUFL.Score;
  override get bars() {
    return super.bars as SMUFL.Bar[];
  }
  override getMasterbarBars(masterbarId: number) {
    return super.getMasterbarBars(masterbarId) as SMUFL.Bar[];
  }
  static import(data: ReturnType<Track["export"]>) {
    return new Track(super.import(data));
  }
}
