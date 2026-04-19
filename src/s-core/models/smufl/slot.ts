import * as SMUFL from ".";
import * as Sheet from "../sheet";
export class Slot extends Sheet.Slot {
  declare score: SMUFL.Score;
  getTrackStaveNotes(trackId: number, staveId: number) {
    return super.getTrackStaveNotes(trackId, staveId) as SMUFL.Note[];
  }
}
