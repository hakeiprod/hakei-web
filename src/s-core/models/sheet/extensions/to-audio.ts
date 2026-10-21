import { sheetScoreSchema } from "../../import/score-schema";
import { capabilities } from "../notation/capabilities";
import { performanceNotes } from "../notation/performance-events";
import * as Sheet from "..";
import * as Audio from "../../audio";

declare module ".." {
  interface Score {
    toAudio(): Audio.Score;
  }
}

Sheet.Score.prototype.toAudio = function (this: Sheet.Score) {
  const validated = sheetScoreSchema.parse({
    ...this.export(),
    slots: [],
    rows: [],
  });
  if (!capabilities(validated).canPlayback)
    throw new Error("Score playback is unavailable");
  const ids = new Set(
    performanceNotes(validated.notes).map((n) => `${n.trackId}:${n.id}`),
  );
  return Audio.Score.import({
    ...this.export(),
    notes: this.notes
      .filter((note) => !note.rest && ids.has(`${note.trackId}:${note.id}`))
      .map((note) => ({
        ...note.export(),
        masterbarId: note.stave.bar.masterbar.id,
        pitch: note.pitch!.value,
      })),
  });
};
