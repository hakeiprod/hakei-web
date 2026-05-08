import { ScorePartwise } from "./score-partwise";

export class ScorePart {
  get partName() {
    return this.data.$$["part-name"]?.[0]._;
  }
  constructor(
    public data: NonNullable<
      NonNullable<
        ScorePartwise["data"]["$$"]["part-list"]
      >[0]["$$"]["score-part"]
    >[number],
    public scorePartwise: ScorePartwise,
  ) {}
}
