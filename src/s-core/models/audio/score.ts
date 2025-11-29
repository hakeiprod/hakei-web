import * as Audio from ".";
import * as Core from "../core";
export class Score<
  Note extends Audio.Note = Audio.Note,
  Track extends Audio.Track = Audio.Track,
> extends Core.Score<Note, Track> {
  onChangeGain?: (value: number) => void;
  constructor(
    parameters: ConstructorParameters<typeof Core.Score<Note, Track>>[0]
  ) {
    super(parameters);
    for (const note of this.notes) note.score = this;
  }

  static import(data: ReturnType<Score["export"]>) {
    const core = super.import(data);
    return new Score({
      ...core,
      notes: core.notes.map((note) => new Audio.Note(note)),
      tracks: core.tracks.map((track) => new Audio.Track(track)),
    });
  }
  static create(...parameters: Parameters<typeof Core.Score.create>) {
    const core = super.create(...parameters);
    return new Score({
      ...core,
      notes: core.tracks.flatMap((track) =>
        track.notes.map((note) => new Audio.Note(note))
      ),
      tracks: core.tracks.map((track) => new Audio.Track(track)),
    });
  }
  setGain() {
    this.onChangeGain?.(0);
  }
}
