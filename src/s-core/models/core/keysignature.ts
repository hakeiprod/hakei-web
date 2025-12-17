import * as Core from ".";
import musicTheory from "../../const/music-theory.json";
export class Keysignature extends Core.Event {
  tonality;
  accidental;
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
  serialize() {
    return {
      ...super.serialize(),
      tonality: this.tonality,
      accidental: this.accidental,
    };
  }
  export() {
    return this.serialize();
  }
  static import(data: ReturnType<Keysignature["export"]>) {
    return new Keysignature({
      ...data,
      start: new Core.Units.Beat(data.start),
      duration: new Core.Units.Beat(data.duration),
      end: new Core.Units.Beat(data.end),
    });
  }
}
