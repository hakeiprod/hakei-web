import musicTheory from "../../../const/music-theory.json";
import { ValueObject } from "../../valueobject";
import { MidiNoteNumber } from "./midi-note-number";
import { PitchClassName } from "./pitch-class-name";

export class ScientificPitchNotation extends ValueObject<string> {
  declare value: `${(typeof musicTheory.diatonicScale)[number]}${string}${number}`;
  get octave() {
    return Number(this.value.slice(-1));
  }
  get alter() {
    return this.value.slice(1, -1);
  }
  get step() {
    return this.value[0] as (typeof musicTheory.diatonicScale)[number];
  }
  getDegree(scientificPitchNotation: ScientificPitchNotation) {
    return (
      this.toPitchClassName().getDegree(
        scientificPitchNotation.toPitchClassName(),
      ) +
      (this.octave - scientificPitchNotation.octave) *
        musicTheory.diatonicScale.length
    );
  }
  toPitchClassName() {
    return new PitchClassName(this.step);
  }
  toMidiNoteNumber() {
    return new MidiNoteNumber(
      (this.octave + 1) * 12 +
        musicTheory.chromaticScale.indexOf(this.step) +
        (this.alter.includes("#") ? this.alter.length : -this.alter.length),
    );
  }
  protected validate(value: typeof this.value) {
    if (!PitchClassName.isPitchClassName(this.step)) throw new Error("Invalid");
    return value;
  }
}
