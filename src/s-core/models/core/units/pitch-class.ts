import { P, match } from "ts-pattern";
import { IntRange } from "type-fest";
import musicTheory from "../../../const/music-theory.json";
import { ValueObject } from "../../valueobject";
import { Tonality } from "../enums/tonality";
import { PitchClassName } from "./pitch-class-name";

export class PitchClass extends ValueObject<number> {
  declare value: IntRange<0, 12>;
  toPitchClassName(tonality: Tonality) {
    return new PitchClassName(
      match(this.value)
        .with(
          P.union(...musicTheory.accidentalPitchClasses),
          (pitchClass) =>
            musicTheory.chromaticScale[
              pitchClass +
                match(tonality)
                  .with(Tonality.Major as 0, () => 1)
                  .with(Tonality.Minor as 1, () => -1)
                  .exhaustive()
            ]!.toString() + musicTheory.accidentals[tonality]
        )
        .otherwise(
          () => musicTheory.chromaticScale[this.value]!
        ) as PitchClassName["value"]
    );
  }
  validate(value: typeof this.value) {
    if (!this.isInRange(value)) throw new Error("Invalid");
    return value;
  }
  private isInRange(value: number): value is PitchClass["value"] {
    return 0 <= value && value <= 11;
  }
}
