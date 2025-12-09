import * as Core from "../core";
import * as Audio from ".";
import { firstBy, prop } from "remeda";
import { MidiNoteNumber } from "../core/units";

export class Track extends Core.Track {
  onChangeGain?: (value: number) => void;
  override get notes() {
    return super.notes as Audio.Note[];
  }
  get keyRange() {
    return (["asc", "desc"] as const).map(
      (sort) =>
        firstBy(
          this.notes.filter((note) => 0 <= note.pitch.value),
          [prop("pitch", "value"), sort]
        )!.pitch
    ) as [min: MidiNoteNumber, max: MidiNoteNumber];
  }
  setGain() {
    this.onChangeGain?.(0);
  }
}
