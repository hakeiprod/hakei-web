import mitt from "mitt";
import { firstBy, prop } from "remeda";
import * as Audio from ".";
import * as Core from "../core";
import { MidiNoteNumber } from "../core/units";
import { PositiveIntSchema } from "../validator";

type Events = {
  changeGain: Audio.Units.Gain;
  changeMute: boolean;
};
export class Track extends Core.Track {
  isMute = false;
  gain = new Audio.Units.Gain(1);
  emitter = mitt<Events>();
  override get notes() {
    return super.notes as Audio.Note[];
  }
  get keyRange() {
    return (["asc", "desc"] as const).map(
      (sort) =>
        firstBy(
          this.notes.filter(
            (note) => PositiveIntSchema.safeParse(note.pitch.value).success,
          ),
          [prop("pitch", "value"), sort],
        )!.pitch,
    ) as [min: MidiNoteNumber, max: MidiNoteNumber];
  }
  setMute(value: typeof this.isMute) {
    this.emitter.emit("changeMute", (this.isMute = value));
  }
  setGain(value: Audio.Units.Gain) {
    this.emitter.emit("changeGain", value);
  }
}
