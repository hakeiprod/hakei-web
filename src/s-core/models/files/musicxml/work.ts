import { ScorePartwise } from "./score-partwise";

export class Work {
  get workTitle() {
    return this.data?.$$?.["work-title"]?.[0]?._ ?? "";
  }
  constructor(
    public data: NonNullable<ScorePartwise["data"]["$$"]["work"]>[number],
    public scorePartwise: ScorePartwise,
  ) {}
}
