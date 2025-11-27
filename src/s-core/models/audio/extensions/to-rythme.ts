import * as Rythme from "../../rythme";
import * as Audio from "..";

declare module ".." {
  interface Score {
    toRythme(): Rythme.Score;
  }
}

Audio.Score.prototype.toRythme = function (this: Audio.Score) {
  return Rythme.Score.create({
    ...this.params,
    tracks: this.tracks.map((track) => ({
      ...track.params,
      notes: track.notes.map(({ params: params }) => params),
    })),
  });
};
