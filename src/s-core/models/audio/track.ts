import * as Core from "../core";
import * as Audio from ".";

export class Track extends Core.Track {
  onChangeGain?: (value: number) => void;
  override get notes() {
    return super.notes as Audio.Note[];
  }
  setGain() {
    this.onChangeGain?.(0);
  }
}
