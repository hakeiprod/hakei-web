import mitt from "mitt";
import { firstBy, prop } from "remeda";
import * as Audio from ".";
import * as Core from "../core";

type Events = {
  noteOn?: null;
  noteOff?: null;
};
export class Note extends Core.Note {
  emitter = mitt<Events>();
  masterbarId;
  score!: Audio.Score;
  get masterbar() {
    return this.score.masterbars.find(
      (masterbar) => masterbar.id === this.masterbarId,
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
    } & ConstructorParameters<typeof Core.Note>[0],
  ) {
    const { masterbarId } = note;
    super(note);
    this.masterbarId = masterbarId;
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
