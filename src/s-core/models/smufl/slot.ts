import * as SMUFL from ".";
import * as Sheet from "../sheet";
export class Slot extends Sheet.Slot {
  declare score: SMUFL.Score;
  getTrackStaveChords(trackId: number, staveId: number) {
    return super.getTrackStaveChords(trackId, staveId) as SMUFL.Chord[];
  }
}
