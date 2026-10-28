import mitt from "mitt";
import * as Audio from ".";
import * as Core from "../core";
import { MidiNoteNumber } from "../core/units";
import { NonNegativeIntSchema } from "../validator";

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
  get keyRange(): [min: MidiNoteNumber, max: MidiNoteNumber] {
    // Validation is unchanged, but equal numeric pitches need the schema only
    // once per scan. Keep this local so a changed Score never reuses old bounds.
    const validity = new Map<number, boolean>();
    let minimum: MidiNoteNumber | undefined;
    let maximum: MidiNoteNumber | undefined;
    for (const note of this.notes) {
      const pitch = note.pitch;
      const value = pitch.value;
      let valid = validity.get(value);
      if (valid === undefined) {
        valid = NonNegativeIntSchema.safeParse(value).success;
        validity.set(value, valid);
      }
      if (!valid) continue;
      // Strict comparisons retain the first object when pitches tie, matching
      // both directions of the previous firstBy implementation.
      if (!minimum || value < minimum.value) minimum = pitch;
      if (!maximum || value > maximum.value) maximum = pitch;
    }
    if (!minimum || !maximum) throw new TypeError("Track has no valid pitch");
    return [minimum, maximum];
  }
  setMute(value: typeof this.isMute) {
    this.emitter.emit("changeMute", (this.isMute = value));
  }
  setGain(value: Audio.Units.Gain) {
    this.emitter.emit("changeGain", value);
  }
}
