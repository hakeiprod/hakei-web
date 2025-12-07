import * as Rythme from ".";
import * as Core from "../core";

export class Score<
  Note extends Rythme.Note = Rythme.Note,
> extends Core.Score<Note> {
  static import(data: ReturnType<Score["export"]>) {
    return new Score({
      ...data,
      ...super.import(data),
      notes: data.notes.map((note) =>
        Rythme.Note.import({
          ...note,
          staveId: -1,
          chordId: undefined,
          stem: undefined,
          rest: false,
          voice: -1,
          beam: undefined,
          flag: null,
        })
      ),
    });
  }
}
