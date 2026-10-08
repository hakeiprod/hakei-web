import * as Sheet from "@/s-core/models/sheet";
import * as SMUFL from ".";
import { bindNoteHighlights } from "./extensions/bind-note-highlights";
import "./extensions/to-svg";
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
    this.space(window.innerWidth);
    this.order();
    const debug =
      typeof this.options.debug === "boolean"
        ? this.options.debug
        : this.options.debug.enabled;
    return this.score.toDocument({ debug });
  }
  render() {
    const document = this.toDocument();
    const svg = document.toSVG({
      scale: this.options.scale,
      paddingBottom: 100,
    });
    bindNoteHighlights(this.score, svg);
    return svg;
  }
}
