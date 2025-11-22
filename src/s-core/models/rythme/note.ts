import { isNullish } from "remeda";
import * as Sheet from "../sheet";
import { JudgeType } from "./enums/judge";
//TODO: const
export class Note extends Sheet.Note {
  hitSeconds: number | null = null;
  get isHitted() {
    return this.hitSeconds !== null;
  }
  get judge() {
    if (isNullish(this.hitSeconds)) return JudgeType.Miss;
    const diffSeconds = Math.abs(
      this.hitSeconds - this.start.toSeconds(this.tempo.value)
    );
    if (diffSeconds <= 0.3) return JudgeType.Perfect;
    if (diffSeconds <= 0.5) return JudgeType.Good;
    return JudgeType.Miss;
  }
  canHit(time: number) {
    return Math.abs(time - this.start.toSeconds(this.tempo.value)) <= 1;
  }
}
