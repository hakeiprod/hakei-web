import * as Core from "../core";
import * as Audio from ".";
import { MidiNoteNumber } from "../core/units";
import { firstBy, prop } from "remeda";

export class Note extends Core.Note {
  score!: Audio.Score;
  get tempo() {
    return this.score.tempos.find((tempo) => tempo.isOverlapped(this))!;
  }
  get keysignature() {
    return this.score.keysignatures.find((keysignature) =>
      keysignature.isOverlapped(this)
    )!;
  }
  get soundingPitch() {
    return this.keysignature.accidentalPitchClasses.some(
      (accidentalPitchClass) =>
        accidentalPitchClass.equal(this.pitch.toPitchClass())
    )
      ? new MidiNoteNumber(
          this.pitch.value +
            (Math.sign(this.keysignature.accidental) === 1 ? 1 : -1)
        )
      : this.pitch;
  }
  get isLast() {
    return firstBy(this.score.notes, [prop("end"), "desc"]) === this;
  }
}
