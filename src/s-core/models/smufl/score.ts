import * as Sheet from "../sheet";
import * as SMUFL from ".";

export class Score<
  Note extends SMUFL.Note = SMUFL.Note,
  Track extends SMUFL.Track = SMUFL.Track,
  Stave extends SMUFL.Stave = SMUFL.Stave,
  Bar extends SMUFL.Bar = SMUFL.Bar,
  Masterbar extends SMUFL.Masterbar = SMUFL.Masterbar,
  Row extends SMUFL.Row = SMUFL.Row,
  Timesignature extends SMUFL.Timesignature = SMUFL.Timesignature,
> extends Sheet.Score<Note, Track, Stave, Bar, Masterbar, Row, Timesignature> {
  static override create(parameter: Sheet.Parameter) {
    const sheet = super.create(parameter);
    const score = new Score({
      ...sheet,
      tracks: sheet.tracks.map((track) => new SMUFL.Track(track)),
      masterbars: sheet.masterbars.map(
        (masterbar) => new SMUFL.Masterbar(masterbar)
      ),
      notes: sheet.notes.map((note) => new SMUFL.Note(note)),
      bars: sheet.bars.map((bar) => new SMUFL.Bar(bar)),
      staves: sheet.staves.map((stave) => new SMUFL.Stave(stave)),
      timesignatures: sheet.timesignatures.map(
        (timesignature) => new SMUFL.Timesignature(timesignature)
      ) as [SMUFL.Timesignature, ...SMUFL.Timesignature[]],
    });
    if (process.env.NODE_ENV === "development") console.log({ smufl: score });
    return score;
  }
}
