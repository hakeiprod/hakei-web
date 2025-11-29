import * as Audio from "../../audio";
import * as Core from "../../core";
import "../../../extensions/int16array/to-float32array.extensions";

declare module "../../core" {
  interface Score {
    toAudio(): Audio.Score;
  }
}

Core.Score.prototype.toAudio = function (this: Core.Score) {
  const exported = this.export();
  const audio = Audio.Score.import({
    ...exported,
    notes: exported.notes.filter((note) => note.pitch !== -1),
  });
  if (process.env.NODE_ENV === "development") console.log({ audio });
  return audio;
};
