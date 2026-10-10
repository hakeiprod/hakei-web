import * as Sheet from "@/s-core/models/sheet";
import type * as SMUFL from ".";
export class Controller extends Sheet.Controller {
  declare public score: SMUFL.Score;
  constructor(
    score: SMUFL.Score,
    public options: ConstructorParameters<typeof Sheet.Controller>[1],
  ) {
    super(score, options);
  }
  toDocument() {
    this.layout();
    this.space();
    this.order();
    const debug =
      typeof this.options.debug === "boolean"
        ? this.options.debug
        : this.options.debug.enabled;
    return this.score.toDocument({
      debug,
      pageLayout:
        this.options.layoutType === Sheet.LayoutType.Page
          ? this.pageLayout
          : undefined,
    });
  }
}
