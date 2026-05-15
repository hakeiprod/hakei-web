import musicTheory from "../../../const/music-theory.json";
import { ValueObject } from "../../valueobject";
import { MidiNoteNumber } from "./midi-note-number";
import { PitchClassName } from "./pitch-class-name";

export class ScientificPitchNotation extends ValueObject<string> {
  declare value: `${PitchClassName["value"]}${number}`;
  get octave() {
    return Number(this.value.slice(-1));
  }
  get pitchClassName() {
    return new PitchClassName(this.value.slice(0, -1));
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
    const pitchClassName = value.slice(0, -1);
    if (!PitchClassName.isPitchClassName(pitchClassName))
      throw new Error("Invalid");
    return `${pitchClassName}${Number(value.slice(-1))}` as const;
  }
}
