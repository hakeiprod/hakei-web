import type * as Sheet from "../../sheet";
import { Score } from "../score";
import { bindNoteHighlights } from "./bind-note-highlights";
import "../../document/extensions/to-svg";
import "./to-document";

declare module ".." {
  interface Score {
    toSVG(
      options: Sheet.Controller["options"] & { ratio: number },
    ): SVGSVGElement;
  }
}

/** Compatibility entry point: musical geometry lives in toDocument. */
Score.prototype.toSVG = function (this: Score, options) {
  const debug =
    typeof options.debug === "boolean" ? options.debug : options.debug.enabled;
  const drawing = this.toDocument({ debug });
  const svg = drawing.toSVG({
    scale: options.scale,
    fontSize: options.ratio,
    paddingBottom: 100,
  });

  bindNoteHighlights(this, svg);
  return svg;
};
