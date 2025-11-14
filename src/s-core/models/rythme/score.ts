import * as Rythme from ".";
import * as Sheet from "../sheet";

export class Score<
  Note extends Rythme.Note = Rythme.Note,
  Track extends Sheet.Track = Sheet.Track,
  Stave extends Sheet.Stave = Sheet.Stave,
  Bar extends Sheet.Bar = Sheet.Bar,
  Masterbar extends Sheet.Masterbar = Sheet.Masterbar,
  Row extends Sheet.Row = Sheet.Row,
> extends Sheet.Score<Note, Track, Stave, Bar, Masterbar, Row> {
  static override create(parameter: Sheet.Parameter) {
    const sheet = super.create(parameter);
    const rythme = new Score({
      ...sheet,
      notes: sheet.notes.map((note) => new Rythme.Note(note)),
    });
    if (process.env.NODE_ENV === "development") console.log({ rythme });
    return rythme;
  }
}
