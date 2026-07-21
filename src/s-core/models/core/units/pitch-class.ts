import { IntRange } from "type-fest";
import * as Core from "../";
import musicTheory from "../../../const/music-theory.json";
import { ValueObject } from "../../valueobject";
import { PitchClassName } from "./pitch-class-name";

export class PitchClass extends ValueObject<number> {
  declare value: IntRange<0, 12>;
  toPitchClassName(keysignature: Core.Keysignature) {
    return new PitchClassName(
      musicTheory.pitchNames[keysignature.accidental][this.value],
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
