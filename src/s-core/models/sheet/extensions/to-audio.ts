import { drainSteps, type RenderSteps } from "../render-steps";
import { sheetScoreSchema } from "../../import/score-schema";
import { capabilities } from "../notation/capabilities";
import { performanceNotes } from "../notation/performance-events";
import * as Sheet from "..";
import * as Audio from "../../audio";

declare module ".." {
  interface Score {
    toAudio(): Audio.Score;
    toAudioSteps(): RenderSteps<Audio.Score>;
  }
}

Sheet.Score.prototype.toAudio = function (this: Sheet.Score) {
  return drainSteps(this.toAudioSteps());
};
Sheet.Score.prototype.toAudioSteps = function* (
  this: Sheet.Score,
): RenderSteps<Audio.Score> {
  const data = this.export();
  yield;
  const validated = sheetScoreSchema.parse({
    ...data,
    slots: [],
    rows: [],
  });
  if (!capabilities(validated).canPlayback)
    throw new Error("Score playback is unavailable");
  const ids = new Set(
    performanceNotes(validated.notes).map((n) => `${n.trackId}:${n.id}`),
  );
  const notes: ReturnType<Audio.Score["export"]>["notes"] = [];
  for (const note of this.notes) {
    if (!note.rest && ids.has(`${note.trackId}:${note.id}`))
      notes.push({
        ...note.export(),
        masterbarId: note.stave.bar.masterbar.id,
        pitch: note.pitch!.value,
      });
    yield;
  }
  return yield* Audio.Score.importSteps({ ...data, notes });
};
