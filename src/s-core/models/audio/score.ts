import { drainSteps, mapSteps } from "../sheet/render-steps";
import * as Audio from ".";
import * as Core from "../core";
export class Score<
  Note extends Audio.Note = Audio.Note,
  Track extends Audio.Track = Audio.Track,
  Masterbar extends Audio.Masterbar = Audio.Masterbar,
> extends Core.Score<Note, Track> {
  masterbars: Masterbar[];
  constructor({
    masterbars,
    ...score
  }: { masterbars: Masterbar[] } & ConstructorParameters<
    typeof Core.Score<Note, Track>
  >[0]) {
    super(score);
    this.masterbars = masterbars;
    for (const data of [...this.notes, ...this.masterbars]) data.score = this;
  }
  static import(data: ReturnType<Score["export"]>) {
    return drainSteps(Score.importSteps(data));
  }
  static *importSteps(data: ReturnType<Score["export"]>) {
    const notes = yield* mapSteps(data.notes, function* (note) {
      yield;
      return Audio.Note.import(note);
    });
    const tracks = yield* mapSteps(data.tracks, function* (track) {
      yield;
      return new Audio.Track(Core.Track.import(track));
    });
    const masterbars = yield* mapSteps(data.masterbars, function* (bar) {
      yield;
      return Audio.Masterbar.import(bar);
    });
    const timesignatures = yield* mapSteps(
      data.timesignatures,
      function* (value) {
        yield;
        return Core.Timesignature.import(value);
      },
    );
    const keysignatures = yield* mapSteps(
      data.keysignatures,
      function* (value) {
        yield;
        return Core.Keysignature.import(value);
      },
    );
    const tempos = yield* mapSteps(data.tempos, function* (value) {
      yield;
      return Core.Tempo.import(value);
    });
    return new Score({
      name: data.name,
      notes,
      tracks,
      masterbars,
      timesignatures,
      keysignatures,
      tempos,
    });
  }
  export() {
    return {
      ...super.export(),
      notes: this.notes.map((data) => data.export()),
      masterbars: this.masterbars.map((data) => data.export()),
    };
  }
}
