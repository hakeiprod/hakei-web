import MusicXML from ".";
import { ScorePartwise as MXLScorePartwise } from "../../../const/musicxml/4.0/musicxml";
import { Part } from "./part";
import { ScorePart } from "./score-part";
import { Work } from "./work";
export class ScorePartwise {
  parts;
  scoreParts;
  works;
  constructor(
    public data: MXLScorePartwise[number],
    public musicXml: MusicXML,
  ) {
    this.parts = this.data.$$.part?.map((part) => new Part(part, this));
    this.scoreParts = this.data.$$["part-list"]?.[0].$$["score-part"]?.map(
      (scorePart) => new ScorePart(scorePart, this),
    );
    this.works = this.data.$$.work?.map((work) => new Work(work, this));
  }
}
