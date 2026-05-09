import { Measure } from "./measure";
import { ScorePartwise } from "./score-partwise";

export class Part {
  mesures;
  get scorePart() {
    return this.scorePartwise.scoreParts?.find(
      (scorePart) => scorePart.data.$?.id === this.data.$?.id,
    );
  }
  constructor(
    public data: NonNullable<ScorePartwise["data"]["part"]>[number],
    public scorePartwise: ScorePartwise,
  ) {
    this.mesures = this.data.measure?.map(
      (measure) => new Measure(measure, this),
    );
  }
}
