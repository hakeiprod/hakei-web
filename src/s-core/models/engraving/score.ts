import * as Engraving from "./";
import * as Sheet from "../sheet";
import type { Document } from "../document";
import { toDocument, type ToDocumentOptions } from "./extensions/to-document";

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

  static import(data: ReturnType<Score["export"]>) {
    return new Score({
      ...data,
      ...super.import(data),
      notes: data.notes.map(Engraving.Note.import),
      tracks: data.tracks.map(Engraving.Track.import),
      timesignatures: data.timesignatures.map(Engraving.Timesignature.import),
      keysignatures: data.keysignatures.map(Engraving.Keysignature.import),
      bars: data.bars.map(Engraving.Bar.import),
      staves: data.staves.map(Engraving.Stave.import),
      masterbars: data.masterbars.map(Engraving.Masterbar.import),
      chords: data.chords.map(Engraving.Chord.import),
    });
  }
}
