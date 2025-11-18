import { isNullish } from "remeda";
import * as Sheet from "../sheet";
import { JudgeType } from "./enums/judge";
//TODO: const
export class Note extends Sheet.Note {
  hitTime: number | null = null;
  get isHitted() {
    return this.hitTime !== null;
  }
  get judge() {
    if (isNullish(this.hitTime)) return JudgeType.Miss;
    const diffTime = Math.abs(this.hitTime - this.start.value);
    if (diffTime <= 20) return JudgeType.Perfect;
    if (diffTime <= 40) return JudgeType.Good;
    return JudgeType.Miss;
  }
  isHit(time: number) {
    return Math.abs(time - this.start.value) <= 60;
  }
}
