import * as Core from "../core";
import musicTheory from "../../const/music-theory.json";
export class Keysignature extends Core.Event {
  tonality;
  accidental;
  override get params() {
    return {
      ...super.params,
      tonality: this.tonality,
      accidental: this.accidental,
    };
  }
  get accidentalPitchClasses() {
    return musicTheory[
      `orderOf${Math.sign(this.accidental) === 1 ? ("Sharps" as const) : ("Flats" as const)}`
    ]
      .slice(0, Math.abs(this.accidental))
      .map((pitch) => new Core.Units.PitchClass(pitch));
  }
  constructor(
    keysignature: {
      accidental: number;
      tonality: Core.Enums.Tonality;
    } & ConstructorParameters<typeof Core.Event>[0]
  ) {
    const { accidental, tonality } = keysignature;
    super(keysignature);
    this.tonality = tonality;
    this.accidental = accidental;
  }
}
