import { ScorePartwise as MXLScorePartwise } from "../../../const/musicxml/4.0/musicxml";
import { toSheet } from "./extensions/to-sheet";
import { ScorePartwise } from "./score-partwise";

export default class MusicXML {
  scorePartwise;
  constructor(public data: { ["score-partwise"]: MXLScorePartwise }) {
    console.log(data);
    this.scorePartwise = new ScorePartwise(data["score-partwise"], this);
  }
  toSheet = toSheet;
}
