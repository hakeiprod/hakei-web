import { MusicXML as MXLMusicXML } from "../../../const/musicxml/4.0/musicxml";
import { toSheet } from "./extensions/to-sheet";
import { ScorePartwise } from "./score-partwise";

export default class MusicXML {
  scorePartwise;
  constructor(public data: MXLMusicXML) {
    this.scorePartwise = new ScorePartwise(data["score-partwise"], this);
  }
  toSheet = toSheet;
}
