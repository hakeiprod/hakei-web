import type { Score } from "../engraving/score";
import { drainSteps, type RenderSteps } from "../sheet/render-steps";

export interface HighlightBinding {
  activate(): void;
  deactivate(): void;
  dispose(): void;
}

/** Prepare detached nodes without replacing callbacks on the committed score. */
export function* prepareNoteHighlightsSteps(
  score: Score,
  svg: SVGSVGElement,
  onHighlight?: (node: SVGGElement) => void,
): RenderSteps<HighlightBinding> {
  const nodesByNote = new Map<string, SVGGElement[]>();
  const walker = svg.ownerDocument.createTreeWalker(svg, 1);
  while (walker.nextNode()) {
    const element = walker.currentNode as SVGElement;
    if (element.tagName === "g" && element.getAttribute("type") === "glyph") {
      const parent = element.closest<SVGGElement>(
        'g[type="note"][data-track-id][data-note-id]',
      );
      if (parent) {
        const key = `${parent.dataset.trackId}/${parent.dataset.noteId}/${element.dataset.glyphName}`;
        const nodes = nodesByNote.get(key) ?? [];
        nodes.push(element as SVGGElement);
        nodesByNote.set(key, nodes);
      }
    }
    yield;
  }
  const plans: { install: () => void; remove: () => void }[] = [];
  for (const note of score.notes) {
    const glyph = note.glyph;
    const nodes =
      nodesByNote.get(`${note.trackId}/${note.id}/${glyph.glyphName}`) ?? [];
    if (nodes.length === 0) {
      yield;
      continue;
    }
    // Each callback captures this prepared page’s nodes and scroll owner.
    // eslint-disable-next-line unicorn/consistent-function-scoping
    const update = (classes: string[]) => {
      const value = classes.join(" ");
      for (const node of nodes) {
        if (node.getAttribute("class") !== value)
          node.setAttribute("class", value);
        if (classes.includes("note-highlight")) onHighlight?.(node);
      }
    };
    // Initial class application is cooperative and detached. Scrolling is
    // deferred until activation, when these nodes become the committed page.
    const value = glyph.classList.join(" ");
    for (const node of nodes)
      if (node.getAttribute("class") !== value)
        node.setAttribute("class", value);
    plans.push({
      install: () => {
        glyph.onClassListChange = update;
        update(glyph.classList);
      },
      remove: () => {
        if (glyph.onClassListChange === update)
          glyph.onClassListChange = undefined;
      },
    });
    yield;
  }
  nodesByNote.clear();
  let active = false,
    disposed = false;
  return {
    activate() {
      if (disposed || active) return;
      active = true;
      for (const plan of plans) plan.install();
    },
    deactivate() {
      if (!active) return;
      active = false;
      for (const plan of plans) plan.remove();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (active) for (const plan of plans) plan.remove();
      plans.length = 0;
    },
  };
}

/** Connect playback class changes to the latest SVG using the common preparation. */
export function bindNoteHighlights(
  score: Score,
  svg: SVGSVGElement,
  onHighlight?: (node: SVGGElement) => void,
) {
  const binding = drainSteps(
    prepareNoteHighlightsSteps(score, svg, onHighlight),
  );
  binding.activate();
  return () => binding.dispose();
}
