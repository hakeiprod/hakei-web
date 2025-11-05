import * as Core from "../core";
import * as Audio from ".";

export class Track extends Core.Track {
  override get notes() {
    return super.notes as Audio.Note[];
  }
}
