import type * as Sheet from "../../sheet";
import { Score } from "../score";
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

  // Bind playback changes at the browser boundary, keeping Document detached.
  for (const note of this.notes) {
    const nodes = [
      ...svg.querySelectorAll<SVGGElement>(
        `g[type="note"][data-track-id="${note.trackId}"][data-note-id="${note.id}"] g[type="glyph"]`,
      ),
    ].filter((node) => node.dataset.glyphName === note.glyph.glyphName);
    note.glyph.onClassListChange = (classes) => {
      for (const node of nodes) node.setAttribute("class", classes.join(" "));
    };
  }
  return svg;
};
