import * as Sheet from "@/s-core/models/sheet";
import * as SMUFL from ".";
export class Controller extends Sheet.Controller {
  declare public score: SMUFL.Score;
  constructor(
    score: SMUFL.Score,
    public options: ConstructorParameters<typeof Sheet.Controller>[1],
  ) {
    super(score, options);
  }
  render() {
    this.layout();
    this.space(window.innerWidth);
    this.order();
    return this.score.toSVG({ ...this.options, ratio: 4 });
  }
}
