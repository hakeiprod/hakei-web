import { firstBy, prop } from "remeda";
import * as Audio from ".";
import * as Core from "../core";

export class Note extends Core.Note {
  masterbarId;
  score!: Audio.Score;
  onNoteOn;
  onNoteOff;
  override get params() {
    return {
      ...super.params,
      onNoteOff: this.onNoteOff,
      onNoteOn: this.onNoteOn,
    };
  }
  get masterbar() {
    return this.score.masterbars.find(
      (masterbar) => masterbar.id === this.masterbarId
    )!;
  }
  get isLast() {
    return firstBy(this.score.notes, [prop("end", "value"), "desc"]) === this;
  }
  get isMasterbarLast() {
    return (
      firstBy(this.masterbar.notes, [prop("end", "value"), "desc"]) === this
    );
  }
  constructor(
    note: {
      masterbarId: number;
      onNoteOn?: () => void;
      onNoteOff?: () => void;
    } & ConstructorParameters<typeof Core.Note>[0]
  ) {
    const { masterbarId, onNoteOn, onNoteOff } = note;
    super(note);
    this.masterbarId = masterbarId;
    this.onNoteOn = onNoteOn;
    this.onNoteOff = onNoteOff;
  }
  serialize() {
    return {
      ...super.serialize(),
      masterbarId: this.masterbarId,
    };
  }
  export() {
    return this.serialize();
  }
  static import(data: ReturnType<Note["export"]>) {
    const core = super.import(data);
    return new Note({
      ...data,
      ...core,
      start: core.start,
      duration: core.duration,
      end: core.end,
    });
  }
}
