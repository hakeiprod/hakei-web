import * as Sheet from "../sheet";
import * as SMUFL from "../smufl";
import { isNullish } from "remeda";
import { JudgeType } from "./enums/judge";
//TODO: const
export class Note extends Sheet.Note {
  hitSeconds: number | null = null;
  get searchParamsLabel() {
    const searchParams = new URLSearchParams();
    searchParams.append("type", "note");
    searchParams.append("id", this.id.toString());
    searchParams.append("trackId", this.trackId.toString());
    return searchParams;
  }
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
  get noteheadGlyph() {
    return new SMUFL.Glyph(
      SMUFL.Glyph.findNotehead(this.type),
      Sheet.ElementType.Notehead
    );
  }
  static import(data: ReturnType<Note["export"]>) {
    return new Note(super.import(data));
  }
}
