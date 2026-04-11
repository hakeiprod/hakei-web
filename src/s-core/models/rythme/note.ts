import { isNullish } from "remeda";
import { Seconds } from "../files/soundfont2/units/seconds";
import * as Sheet from "../sheet";
import * as SMUFL from "../smufl";
import { JudgeType } from "./enums/judge";
export class Note extends Sheet.Note {
  hitSeconds: Seconds | null = null;
  get isHitted() {
    return this.hitSeconds !== null;
  }
  get judge() {
    if (isNullish(this.hitSeconds)) return JudgeType.Miss;
    const diffSeconds = Math.abs(
      this.hitSeconds.subtract(this.start.toSeconds(this.tempo.value)).value,
    );
    if (diffSeconds <= 0.3) return JudgeType.Perfect;
    if (diffSeconds <= 0.5) return JudgeType.Good;
    return JudgeType.Miss;
  }
  canHit(seconds: Seconds) {
    return (
      Math.abs(
        seconds.subtract(this.start.toSeconds(this.tempo.value)).value,
      ) <= 1
    );
  }
  get noteheadGlyph() {
    return new SMUFL.Glyph(
      SMUFL.Glyph.findNotehead(this.type),
      Sheet.ElementType.Notehead,
    );
  }
  static import(data: ReturnType<Note["export"]>) {
    return new Note(super.import(data));
  }
}
