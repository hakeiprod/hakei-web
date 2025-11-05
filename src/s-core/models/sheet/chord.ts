import { filter, firstBy, isTruthy, map, pipe, prop } from "remeda";
import * as Core from "../core";
import * as Sheet from ".";
export class Chord extends Core.Event {
  readonly id;
  staveId;
  trackId;
  voice;
  score!: Sheet.Score;
  ligature: Sheet.Ligature | null = null;
  get params() {
    return {
      ...super.params,
      id: this.id,
      staveId: this.staveId,
      trackId: this.trackId,
      voice: this.voice,
    };
  }
  get notes() {
    return this.score.notes.filter((note) => note.chordId === this.id);
  }
  override get start() {
    return firstBy(this.notes, [prop("start"), "asc"])!.start;
  }
  override get end() {
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
  draw() {
    this.ligature = new Sheet.Ligature(
      [pipe(this.notes, map(prop("ligature")), filter(isTruthy))],
      0
    );
  }
}
