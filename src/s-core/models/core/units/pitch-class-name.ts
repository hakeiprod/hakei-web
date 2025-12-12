import * as R from "remeda";
import { match } from "ts-pattern";
import musicTheory from "../../../const/music-theory.json";
import { ValueObject } from "../../valueobject";
import { PitchClass } from "./pitch-class";

type DiatonicScale = (typeof musicTheory.diatonicScale)[number];
type Accidental = (typeof musicTheory.accidentals)[number] | "";

export class PitchClassName extends ValueObject<string> {
  declare value: `${DiatonicScale}${Accidental}`;
  get accidental() {
    const accidental = this.value[1] ?? "";
    this.assertAccidental(accidental);
    return accidental;
  }
  get tone() {
    const tone = this.value[0]!;
    this.assertTone(tone);
    return tone;
  }
  get toneIndex() {
    return musicTheory.diatonicScale.indexOf(this.tone);
  }
  getDegree(pitchClassName: PitchClassName) {
    return this.toneIndex - pitchClassName.toneIndex;
  }
  toPitchClass() {
    return new PitchClass(
      musicTheory.chromaticScale.indexOf(this.tone) +
        match(this.accidental)
          .with("#", () => 1)
          .with("b", () => -1)
          .with("", () => 0)
          .exhaustive()
    );
  }
  static isPitchClassName(value: string): value is PitchClassName["value"] {
    const tone = value[0]!;
    const accidental = value[1] ?? "";
    return this.isTone(tone) && this.isAccidental(accidental);
  }
  private assertAccidental(value: string): asserts value is Accidental {
    if (PitchClassName.isAccidental(value)) return;
    throw new Error("Invalid");
  }
  private static isAccidental(value: string): value is Accidental {
    return [...musicTheory.accidentals, ""].includes(value);
  }
  private assertTone(value: string): asserts value is DiatonicScale {
    if (PitchClassName.isTone(value)) return;
    throw new Error("Invalid");
  }
  private static isTone(value: string): value is DiatonicScale {
    return R.isDefined(musicTheory.diatonicScale.find((v) => v === value));
  }
  protected validate(value: typeof this.value) {
    const tone = value[0]!;
    const accidental = value[1] ?? "";
    if (!PitchClassName.isTone(tone)) throw new Error("Invalid");
    if (!PitchClassName.isAccidental(accidental)) throw new Error("Invalid");
    return `${tone}${accidental}` as const;
  }
}
