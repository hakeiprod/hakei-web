import type { Score } from "../smufl/score";

/** Connect playback class changes to the latest SVG without coupling Document to SMUFL. */
export function bindNoteHighlights(
  score: Score,
  svg: SVGSVGElement,
  onHighlight?: (node: SVGGElement) => void,
) {
  const unbind: (() => void)[] = [];
  for (const note of score.notes) {
    const nodes = [
      ...svg.querySelectorAll<SVGGElement>(
        `g[type="note"][data-track-id="${note.trackId}"][data-note-id="${note.id}"] g[type="glyph"]`,
      ),
    ].filter((node) => node.dataset.glyphName === note.glyph.glyphName);
    const glyph = note.glyph;
    glyph.onClassListChange = (classes) => {
      for (const node of nodes) {
        node.setAttribute("class", classes.join(" "));
        if (classes.includes("note-highlight")) onHighlight?.(node);
      }
    };
    const update = glyph.onClassListChange;
    // Cached pages may predate a playback highlight change.
    update(glyph.classList);
    unbind.push(() => {
      if (glyph.onClassListChange === update)
        glyph.onClassListChange = undefined;
    });
  }
  return () => {
    for (const unsubscribe of unbind) unsubscribe();
  };
}
