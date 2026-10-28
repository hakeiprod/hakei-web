import * as Engraving from "./";
import * as Sheet from "../sheet";
import type { Document } from "../document";
import { Tempo } from "../core/tempo";
import { importScorePartsSteps } from "../sheet/import-score-parts";
import { drainSteps } from "../sheet/render-steps";
import {
  toDocument,
  toDocumentSteps,
  type ToDocumentOptions,
} from "./extensions/to-document";

export class Score<
  Note extends Engraving.Note = Engraving.Note,
  Track extends Engraving.Track = Engraving.Track,
  Stave extends Engraving.Stave = Engraving.Stave,
  Bar extends Engraving.Bar = Engraving.Bar,
  Masterbar extends Engraving.Masterbar = Engraving.Masterbar,
  Row extends Engraving.Row = Engraving.Row,
  Timesignature extends Engraving.Timesignature = Engraving.Timesignature,
  Slot extends Engraving.Slot = Engraving.Slot,
  Chord extends Engraving.Chord = Engraving.Chord,
> extends Sheet.Score<
  Note,
  Track,
  Stave,
  Bar,
  Masterbar,
  Row,
  Timesignature,
  Slot,
  Chord,
  Engraving.Keysignature
> {
  /** Convert drawn, laid out and ordered geometry into a detached snapshot. */
  toDocument(options?: ToDocumentOptions): Document {
    return toDocument(this, options);
  }

  *toDocumentSteps(options?: ToDocumentOptions) {
    return yield* toDocumentSteps(this, options);
  }

  static import(data: ReturnType<Score["export"]>) {
    return drainSteps(Score.importSteps(data));
  }
  static *importSteps(data: ReturnType<Score["export"]>) {
    const parts = yield* importScorePartsSteps(data, {
      note: Engraving.Note.import,
      track: Engraving.Track.import,
      stave: Engraving.Stave.import,
      bar: Engraving.Bar.import,
      masterbar: Engraving.Masterbar.import,
      chord: Engraving.Chord.import,
      timesignature: Engraving.Timesignature.import,
      keysignature: Engraving.Keysignature.import,
      tempo: Tempo.import,
    });
    const score = new Score({ ...data, ...parts }, true);
    yield* score.initializeSteps();
    return score;
  }
}
