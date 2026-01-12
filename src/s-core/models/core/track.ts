import { firstBy, prop } from "remeda";
import * as Core from "../core";

export class Track extends Core.Event {
  readonly id;
  name;
  preset;
  score!: Core.Score;
  get notes() {
    return this.score.notes.filter((note) => note.trackId === this.id);
  }
  override get start() {
    return firstBy(this.notes, [prop("start"), "asc"])!.start;
  }
  override get end() {
    return firstBy(this.notes, [prop("end"), "desc"])!.end;
  }
  constructor({
    id,
    name = "",
    preset,
    ...event
  }: {
    id: number;
    name?: string;
    preset: Core.Units.Preset;
  }) {
    super(event);
    this.id = id;
    this.name = name;
    this.preset = preset;
  }
  serialize() {
    return {
      ...super.serialize(),
      id: this.id,
      name: this.name,
      preset: this.preset.value,
    };
  }
  export() {
    return this.serialize();
  }
  static import(data: ReturnType<Track["export"]>) {
    return new Track({ ...data, preset: new Core.Units.Preset(data.preset) });
  }
}
