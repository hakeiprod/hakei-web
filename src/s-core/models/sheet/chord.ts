import { firstBy, prop } from "remeda";
import * as Sheet from ".";
import * as Core from "../core";
export class Chord extends Core.Event {
  readonly id;
  staveId;
  trackId;
  voice;
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
  constructor({
    id,
    staveId,
    trackId,
    voice,
    ...event
  }: {
    id: number;
    staveId: number;
    trackId: number;
    voice: number;
  }) {
    super(event);
    this.id = id;
    this.staveId = staveId;
    this.trackId = trackId;
    this.voice = voice;
  }
  serialize() {
    return {
      ...super.serialize(),
      id: this.id,
      staveId: this.staveId,
      trackId: this.trackId,
      voice: this.voice,
    };
  }
  export() {
    return { ...super.export(), ...this.serialize() };
  }
  static import(data: ReturnType<Chord["export"]>) {
    return new Chord(data);
  }
}
