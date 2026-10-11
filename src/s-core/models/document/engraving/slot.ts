import * as Engraving from ".";
import * as Sheet from "../../sheet";
export class Slot extends Sheet.Slot {
  declare score: Engraving.Score;
  getTrackStaveChords(trackId: number, staveId: number) {
    return super.getTrackStaveChords(trackId, staveId) as Engraving.Chord[];
  }
}
