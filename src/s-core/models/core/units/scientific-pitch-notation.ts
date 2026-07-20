import musicTheory from "../../../const/music-theory.json";
import { ValueObject } from "../../valueobject";
import { MidiNoteNumber } from "./midi-note-number";
import { PitchClassName } from "./pitch-class-name";

export class ScientificPitchNotation extends ValueObject<string> {
  declare value: `${PitchClassName["value"]}${string}${number}`;
  get octave() {
    return Number(this.value.slice(-1));
  }
  get alter() {
    return this.value.slice(1, -1);
  }
  get pitchClassName() {
    console.log(this.value);
    return new PitchClassName(this.value[0]);
  }
  getDegree(scientificPitchNotation: ScientificPitchNotation) {
    return (
      this.pitchClassName.getDegree(scientificPitchNotation.pitchClassName) +
      (this.octave - scientificPitchNotation.octave) *
        musicTheory.diatonicScale.length
    );
  }
  toMidiNoteNumber() {
    return new MidiNoteNumber(
      (this.octave + 1) * 12 + this.pitchClassName.toPitchClass().value,
    );
  }
  static readonly MIDDLE_C = "C4";
  protected validate(value: typeof this.value) {
    if (!PitchClassName.isPitchClassName(this.pitchClassName.value))
      throw new Error("Invalid");
    return value;
  }
}
