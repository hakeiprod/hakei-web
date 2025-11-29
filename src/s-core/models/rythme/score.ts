import * as Rythme from ".";
import * as Core from "../core";

export class Score<
  Note extends Rythme.Note = Rythme.Note,
> extends Core.Score<Note> {
  static override create(parameter: Core.Parameter) {
    const sheet = super.create(parameter);
    const rythme = new Score({
      ...sheet,
      notes: sheet.notes.map((note) => new Rythme.Note(note)),
    });
    if (process.env.NODE_ENV === "development") console.log({ rythme });
    return rythme;
  }
  static import(data: ReturnType<Score["export"]>) {
    return new Score({
      ...data,
      ...super.import(data),
      notes: data.notes.map(Rythme.Note.import),
    });
  }
}
