import * as Audio from ".";
import * as Core from "../core";
export class Score<
  Note extends Audio.Note = Audio.Note,
  Track extends Audio.Track = Audio.Track,
  Masterbar extends Audio.Masterbar = Audio.Masterbar,
> extends Core.Score<Note, Track> {
  masterbars: Masterbar[];
  onChangeGain?: (value: number) => void;
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
    const core = super.import(data);
    return new Score({
      ...core,
      notes: data.notes.map(Audio.Note.import),
      tracks: core.tracks.map((track) => new Audio.Track(track)),
      masterbars: data.masterbars.map(Audio.Masterbar.import),
    });
  }
  export() {
    return {
      ...super.export(),
      notes: this.notes.map((data) => data.export()),
      masterbars: this.masterbars.map((data) => data.export()),
    };
  }
  setGain() {
    this.onChangeGain?.(0);
  }
}
