import mitt from "mitt";
import { firstBy, prop } from "remeda";
import * as Audio from ".";
import * as Core from "../core";
import { MidiNoteNumber } from "../core/units";

type Events = {
  onChangeGain: number;
};
export class Track extends Core.Track {
  emitter = mitt<Events>();
  override get notes() {
    return super.notes as Audio.Note[];
  }
  get keyRange() {
    return (["asc", "desc"] as const).map(
      (sort) =>
        firstBy(
          this.notes.filter((note) => 0 <= note.pitch.value),
          [prop("pitch", "value"), sort],
        )!.pitch,
    ) as [min: MidiNoteNumber, max: MidiNoteNumber];
  }
}
