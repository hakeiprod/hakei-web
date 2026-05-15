import { prop } from "remeda";
import { ScorePartwise as MXLScorePartwise } from "../../../const/musicxml/4.0/musicxml";
import { toSheet } from "./extensions/to-sheet";
import { ScorePartwise } from "./score-partwise";

export default class MusicXML {
  get name() {
    return prop(
      this.data,
      "score-partwise",
      "credit",
      0,
      "credit-words",
      0,
      "_",
    );
  }
  scorePartwise;
  constructor(
    public data: {
      ["score-partwise"]: MXLScorePartwise[0];
    },
  ) {
    console.log(this.data);
    this.scorePartwise = new ScorePartwise(data["score-partwise"], this);
  }
  toSheet = toSheet;
}
