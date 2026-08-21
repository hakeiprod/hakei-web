import musicTheory from "../../../const/music-theory.json";
import { NonNegativeIntSchema } from "../../validator";
import { ValueObject } from "../../valueobject";
import { PitchClass } from "./pitch-class";
import { ScientificPitchNotation } from "./scientific-pitch-notation";
export class MidiNoteNumber extends ValueObject<number> {
  toPitchClass() {
    return new PitchClass(this.value % musicTheory.pitchClasses.length);
  }
  toScientificPitchNotation(
    ...arguments_: Parameters<PitchClass["toPitchClassName"]>
  ) {
    return new ScientificPitchNotation(
      `${this.toPitchClass().toPitchClassName(...arguments_).value}${
        Math.trunc(this.value / musicTheory.pitchClasses.length) - 1
      }`,
    );
  }
  protected validate(value: typeof this.value) {
    NonNegativeIntSchema.optional().parse(value);
    return value;
  }
  static readonly MIDDLE_C = 60;
}

if (process.env.NODE_ENV === "development")
  globalThis.MidiNoteNumberClass = MidiNoteNumber;
declare global {
  var MidiNoteNumberClass: typeof MidiNoteNumber;
}
