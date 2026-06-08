import * as SMUFL from ".";
import * as Sheet from "../sheet";

export class Score<
  Note extends SMUFL.Note = SMUFL.Note,
  Track extends SMUFL.Track = SMUFL.Track,
  Stave extends SMUFL.Stave = SMUFL.Stave,
  Bar extends SMUFL.Bar = SMUFL.Bar,
  Masterbar extends SMUFL.Masterbar = SMUFL.Masterbar,
  Row extends SMUFL.Row = SMUFL.Row,
  Timesignature extends SMUFL.Timesignature = SMUFL.Timesignature,
  Slot extends SMUFL.Slot = SMUFL.Slot,
  Chord extends SMUFL.Chord = SMUFL.Chord,
> extends Sheet.Score<
  Note,
  Track,
  Stave,
  Bar,
  Masterbar,
  Row,
  Timesignature,
  Slot,
  Chord
> {
  static import(data: ReturnType<Score["export"]>) {
    return new Score({
      ...data,
      ...super.import(data),
      notes: data.notes.map(SMUFL.Note.import),
      tracks: data.tracks.map(SMUFL.Track.import),
      timesignatures: data.timesignatures.map(SMUFL.Timesignature.import),
      keysignatures: data.keysignatures.map(Sheet.Keysignature.import),
      bars: data.bars.map(SMUFL.Bar.import),
      staves: data.staves.map(SMUFL.Stave.import),
      masterbars: data.masterbars.map(SMUFL.Masterbar.import),
      chords: data.chords.map(SMUFL.Chord.import),
    });
  }
}
