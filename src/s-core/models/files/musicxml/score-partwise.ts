import MusicXML from ".";
import { Part } from "./part";
import { ScorePart } from "./score-part";
import { Work } from "./work";
export class ScorePartwise {
  parts;
  scoreParts;
  works;
  constructor(
    public data: MusicXML["data"]["score-partwise"],
    public musicXml: MusicXML,
  ) {
    this.parts = this.data?.part?.map((part) => new Part(part, this));
    this.scoreParts = this.data?.["part-list"]
      ?.flatMap((partList) => partList["score-part"])
      .map((scorePart) => new ScorePart(scorePart, this));
    this.works = this.data.work?.map((work) => new Work(work, this));
  }
}
