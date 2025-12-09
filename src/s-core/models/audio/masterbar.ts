import * as Core from "../core";
import { Score } from ".";

export class Masterbar extends Core.Event {
  readonly id;
  declare score: Score;
  get notes() {
    return this.score.notes.filter((note) => note.masterbarId === this.id);
  }
  get tempo() {
    return this.score.tempos.find((tempo) => tempo.isOverlapped(this))!;
  }
  constructor({
    id,
    ...event
  }: { id: number } & ConstructorParameters<typeof Core.Event>[0]) {
    super(event);
    this.id = id;
  }
  serialize() {
    return { id: this.id, ...super.serialize() };
  }
  export() {
    return this.serialize();
  }
  static import(data: ReturnType<Masterbar["export"]>) {
    return new Masterbar({
      id: data.id,
      start: new Core.Units.Beat(data.start),
      duration: new Core.Units.Beat(data.duration),
      end: new Core.Units.Beat(data.end),
    });
  }
}
