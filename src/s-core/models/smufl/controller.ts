import * as Sheet from "@/s-core/models/sheet";
import * as SMUFL from ".";
export class Controller extends Sheet.Controller {
  declare public score: SMUFL.Score;
  constructor(
    score: SMUFL.Score,
    public options: Sheet.ControllerOptions
  ) {
    super(score, options);
  }
}
