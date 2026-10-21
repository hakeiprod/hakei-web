import Bravura from "../../const/bravura/bravura_metadata.json";
import Glyphnames from "../../const/smufl/glyphnames.json";
import type { DrawingRecord } from "../fixtures/evaluate";
const glyphTable = new Map<string, { codepoint: string }>(
  Object.entries(Glyphnames),
);
const boxes = new Map<string, { bBoxNE: number[]; bBoxSW: number[] }>(
  Object.entries(Bravura.glyphBBoxes),
);
/** Inspect SVG semantics without accepting mere SVG existence as success. */
export function svgRecords(pages: readonly SVGSVGElement[]): DrawingRecord[] {
  return pages.flatMap((svg, pageIndex) =>
    [...svg.querySelectorAll<SVGElement>("[type]")].map(
      (node): DrawingRecord => {
        const source: Record<string, number> = {};
        for (const key of ["trackId", "noteId", "staveId", "barId", "rowId"])
          if (node.dataset[key] !== undefined)
            source[key] = Number(node.dataset[key]);
        const number = (name: string) => Number(node.getAttribute(name));
        const text = node.querySelector("text");
        let x = 0,
          y = 0;
        for (
          let parent: Element | null = node;
          parent && parent !== svg;
          parent = parent.parentElement
        ) {
          const match =
            /^translate\(\s*([-+\d.eE]+)[, ]+([-+\d.eE]+)\s*\)$/.exec(
              parent.getAttribute("transform") ?? "",
            );
          if (match) {
            x += Number(match[1]);
            y += Number(match[2]);
          }
        }
        let tabBounds: DrawingRecord["bounds"];
        if (node.dataset.tabValue !== undefined) {
          const ink = [
            ...node.querySelectorAll<SVGTextElement>("text"),
          ].flatMap((t) => {
            const b = boxes.get(t.parentElement?.dataset.glyphName ?? "");
            if (!b) return [];
            const scale = Number.parseFloat(t.getAttribute("font-size") ?? "1"),
              tx = x + Number(t.getAttribute("x")),
              ty = y + Number(t.getAttribute("y"));
            return [
              {
                left: tx + b.bBoxSW[0] * scale,
                right: tx + b.bBoxNE[0] * scale,
                top: ty - b.bBoxNE[1] * scale,
                bottom: ty - b.bBoxSW[1] * scale,
              },
            ];
          });
          if (ink.length > 0) {
            const left = Math.min(...ink.map((b) => b.left)),
              top = Math.min(...ink.map((b) => b.top));
            tabBounds = {
              x: left,
              y: top,
              width: Math.max(...ink.map((b) => b.right)) - left,
              height: Math.max(...ink.map((b) => b.bottom)) - top,
            };
          }
        }
        const glyphName = node.dataset.glyphName;
        const glyph =
          glyphName && Object.hasOwn(Glyphnames, glyphName)
            ? glyphTable.get(glyphName)
            : undefined;
        const validGlyph = Boolean(
          glyph &&
          text?.textContent ===
            String.fromCodePoint(Number.parseInt(glyph.codepoint.slice(2), 16)),
        );
        const d = node.getAttribute("d") ?? "";
        const points = (
          d.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi) ?? []
        ).map(Number);
        const validCurve =
          /^M .* C .* C .* Z$/.test(d) &&
          points.length === 14 &&
          points.every(Number.isFinite) &&
          points[6] > points[0] &&
          points[12] === points[0] &&
          points[13] === points[1];
        return {
          role:
            node.dataset.relationId && !validCurve
              ? "invalid-tie"
              : (node.getAttribute("type") ?? undefined),
          glyphName: validGlyph ? glyphName : undefined,
          ...(node.dataset.tabValue === undefined
            ? {}
            : {
                tabValue: [...node.querySelectorAll<SVGTextElement>("text")]
                  .map((t) => {
                    const code = t.textContent?.codePointAt(0);
                    return code !== undefined &&
                      code >= 0xe0_80 &&
                      code <= 0xe0_89
                      ? String(code - 0xe0_80)
                      : "?";
                  })
                  .join(""),
                string: Number(node.dataset.string),
                fret: Number(node.dataset.fret),
              }),
          bounds: tabBounds,
          anchorRole: node.dataset.anchorRole,
          ...(node.getAttribute("type") === "stem"
            ? {
                direction:
                  number("y2") < number("y1")
                    ? ("up" as const)
                    : ("down" as const),
              }
            : {}),
          source,
          pageIndex,
          ...(text
            ? {
                x: x + Number(text.getAttribute("x")),
                y: y + Number(text.getAttribute("y")),
              }
            : {}),
          ...(node.dataset.tabValue !== undefined && text
            ? {
                y:
                  y +
                  Number(text.getAttribute("y")) -
                  (boxes.get(text.parentElement?.dataset.glyphName ?? "")
                    ?.bBoxNE[1] ?? 0) *
                    Number.parseFloat(text.getAttribute("font-size") ?? "1") +
                  (((boxes.get(text.parentElement?.dataset.glyphName ?? "")
                    ?.bBoxNE[1] ?? 0) -
                    (boxes.get(text.parentElement?.dataset.glyphName ?? "")
                      ?.bBoxSW[1] ?? 0)) *
                    Number.parseFloat(text.getAttribute("font-size") ?? "1")) /
                    2,
              }
            : {}),
          ...(node.tagName === "line"
            ? {
                x: x + number("x1"),
                y: y + number("y1"),
                start: { x: x + number("x1"), y: y + number("y1") },
                end: { x: x + number("x2"), y: y + number("y2") },
              }
            : {}),
          ...(node.dataset.relationId
            ? {
                relationId: node.dataset.relationId,
                part: node.dataset.part,
                startNote: {
                  trackId: Number(node.dataset.startTrackId),
                  noteId: Number(node.dataset.startNoteId),
                },
                endNote: {
                  trackId: Number(node.dataset.endTrackId),
                  noteId: Number(node.dataset.endNoteId),
                },
                start: {
                  x: x + points[0],
                  y: y + points[1],
                },
                end: {
                  x: x + points[6],
                  y: y + points[7],
                },
              }
            : {}),
        };
      },
    ),
  );
}
