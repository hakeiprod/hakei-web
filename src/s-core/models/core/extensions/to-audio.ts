import * as Audio from "../../audio";
import * as Core from "../../core";
import "../../../extensions/int16array/to-float32array.extensions";

declare module "../../core" {
  interface Score {
    toAudio(): Audio.Score;
  }
}

Core.Score.prototype.toAudio = function (this: Core.Score) {
  const audio = Audio.Score.create({
    ...this.params,
    tracks: this.tracks.map((track) => ({
      ...track.params,
      notes: track.notes
        .filter((note) => note.pitch.value !== -1)
        .map(({ params }) => params),
    })),
    keysignatures: this.keysignatures.map(({ params }) => params),
  });
  if (process.env.NODE_ENV === "development") console.log({ audio });
  return audio;
};
