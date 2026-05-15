import { flatMap, pipe, prop } from "remeda";
import MusicXML from ".";
import { Part } from "./part";
import { ScorePart } from "./score-part";
export class ScorePartwise {
  parts;
  scorePart;
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
    this.parts = this.data?.part?.map((part) => new Part(part, this));
    this.scorePart = this.data?.["part-list"]?.[0]["score-part"]?.map(
      (scorePart) => new ScorePart(scorePart, this),
    );
  }
}
