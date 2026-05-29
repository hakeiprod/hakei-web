import { firstBy, prop } from "remeda";
import * as Sheet from ".";
import * as Core from "../core";
export class Chord extends Core.Event<{ id: number }> {
  readonly id;
  score!: Sheet.Score;
  get notes() {
    return this.score.notes.filter((note) => note.chordId === this.id);
  }
  get start() {
    return firstBy(this.notes, [prop("start"), "asc"])!.start;
  }
  get end() {
    return firstBy(this.notes, [prop("end"), "desc"])!.end;
  }
  get staveId() {
    return this.notes[0].staveId!;
  }
  get trackId() {
    return this.notes[0].trackId!;
  }
  get voice() {
    return this.notes[0].voice;
  }
  constructor({ id, ...event }: { id: number }) {
    super(event);
    this.id = id;
  }
  serialize() {
    return { id: this.id };
  }
  export() {
    return this.serialize();
  }
  static import(data: ReturnType<Chord["export"]>) {
    return new Chord(data);
  }
}
