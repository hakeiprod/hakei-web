import type { Score } from "../smufl/score";

/** Connect playback class changes to the latest SVG without coupling Document to SMUFL. */
export function bindNoteHighlights(score: Score, svg: SVGSVGElement) {
  for (const note of score.notes) {
    const nodes = [
      ...svg.querySelectorAll<SVGGElement>(
        `g[type="note"][data-track-id="${note.trackId}"][data-note-id="${note.id}"] g[type="glyph"]`,
      ),
    ].filter((node) => node.dataset.glyphName === note.glyph.glyphName);
    note.glyph.onClassListChange = (classes) => {
      for (const node of nodes) node.setAttribute("class", classes.join(" "));
    };
  }
}
