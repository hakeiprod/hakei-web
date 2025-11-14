import * as Rythme from "../../rythme";
import * as Sheet from "../../sheet";
import "../../../extensions/int16array/to-float32array.extensions";

declare module ".." {
  interface Score {
    toRythme(): Rythme.Score;
  }
}

Sheet.Score.prototype.toRythme = function (this: Sheet.Score) {
  const rythme = Rythme.Score.create({
    ...this.params,
    tracks: this.tracks.map((track) => ({
      ...track.params,
      notes: track.notes.map(({ params }) => params),
    })),
  });
  return rythme;
};
