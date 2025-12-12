import * as Sheet from "..";
import * as Audio from "../../audio";

declare module ".." {
  interface Score {
    toAudio(): Audio.Score;
  }
}

Sheet.Score.prototype.toAudio = function (this: Sheet.Score) {
  return Audio.Score.import({
    ...this.export(),
    notes: this.notes
      .filter((note) => note.pitch.value !== -1)
      .map((note) => ({
        ...note.export(),
        masterbarId: note.stave.bar.masterbar.id,
        pitch: note.pitch.value + (note.alter ?? 0),
      })),
  });
};
