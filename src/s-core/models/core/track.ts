import { firstBy, prop } from "remeda";
import * as Core from "../core";

export class Track extends Core.Event {
  readonly id;
  name;
  preset;
  sourceTrack;
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
    sourceTrack,
  }: {
    id: number;
    name?: string;
    preset: Core.Units.Preset;
    sourceTrack?: number;
  }) {
    // Track bounds are derived from its notes. Serialized numbers must not be
    // passed into Event, whose constructor expects Beat value objects.
    super({});
    this.id = id;
    this.name = name;
    this.preset = preset;
    this.sourceTrack = sourceTrack;
  }
  serialize() {
    return {
      ...super.serialize(),
      id: this.id,
      name: this.name,
      preset: this.preset.value,
      ...(this.sourceTrack === undefined
        ? {}
        : { sourceTrack: this.sourceTrack }),
    };
  }
  export() {
    return this.serialize();
  }
  static import(data: ReturnType<Track["export"]>) {
    return new Track({ ...data, preset: new Core.Units.Preset(data.preset) });
  }
}
