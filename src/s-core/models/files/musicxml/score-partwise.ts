import { firstBy, flatMap, forEach, pipe, prop, reduce } from "remeda";
import MusicXML from ".";
import { Note } from "./note";
import { Part } from "./part";
import { ScorePart } from "./score-part";
export class ScorePartwise {
  parts;
  scorePart;
  get start() {
    return firstBy(this.parts ?? [], prop("start"))?.start ?? 0;
  }
  get duration() {
    return this.end - this.start;
  }
  get end() {
    return firstBy(this.parts ?? [], [prop("end"), "desc"])?.end ?? 0;
  }
  get measures() {
    return pipe(this.parts ?? [], flatMap(prop("measures")));
  }
  get notes() {
    return pipe(this.measures ?? [], flatMap(prop("notes")));
  }
  constructor(
    public data: MusicXML["data"]["score-partwise"],
    public musicXml: MusicXML,
  ) {
    this.parts = this.data?.part?.map((part) => new Part(part, this)) ?? [];
    this.scorePart = this.data?.["part-list"]?.[0]["score-part"]?.map(
      (scorePart) => new ScorePart(scorePart, this),
    );
    // set chordId
    pipe(
      this.notes,
      reduce((accumulator, current) => {
        if (current.chord) accumulator.at(-1)!.push(current);
        else accumulator.push([current]);
        return accumulator;
      }, [] as Note[][]),
      forEach((notes, chordId) => {
        for (const note of notes) note.chordId = chordId;
      }),
    );
  }
}
