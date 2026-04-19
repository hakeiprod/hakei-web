import { firstBy, prop } from "remeda";
import type * as Sheet from ".";
import * as Core from "../core";
import { Beat } from "../core/units";

export class Slot extends Core.Event {
  beat;
  previousSlot;
  score!: Sheet.Score;
  get notes() {
    return this.score.notes.filter((note) => note.start.equal(this.beat));
  }
  get width() {
    return (
      firstBy(this.notes, [prop("ligature", "width"), "desc"])?.ligature
        .width ?? 0
    );
  }
  get x(): number {
    return (this.previousSlot?.x ?? 0) + (this.previousSlot?.width ?? 0);
  }
  constructor({ beat, previousSlot }: { beat: Beat; previousSlot?: Slot }) {
    super({ start: beat, end: beat });
    this.beat = beat;
    this.previousSlot = previousSlot;
  }
  getTrackStaveNotes(trackId: number, staveId: number) {
    return this.notes.filter(
      (note) =>
        note.trackId === trackId &&
        note.staveId === staveId &&
        note.start.equal(this.beat),
    );
  }
  serialize() {
    return {
      ...super.serialize(),
      beat: this.beat,
    };
  }
  export() {
    return this.serialize();
  }
  static import(data: ReturnType<Slot["export"]>) {
    return new Slot(data);
  }
}
