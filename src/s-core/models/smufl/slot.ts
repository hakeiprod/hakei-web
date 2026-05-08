import * as SMUFL from ".";
import * as Sheet from "../sheet";
export class Slot extends Sheet.Slot {
  declare score: SMUFL.Score;
  getTrackStaveNotesOrChords(trackId: number, staveId: number) {
    return super.getTrackStaveNotesOrChords(trackId, staveId) as SMUFL.Note[];
  }
}
