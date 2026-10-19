// @vitest-environment node
import { expect, test } from "vitest";
import * as Core from "../core";
import "../core/extensions/to-sheet";
import * as Drawing from "../document";
import { LayoutType } from "../sheet";
import * as Engraving from ".";

function positioned(
  elements: readonly Drawing.Element[],
  x = 0,
): { element: Drawing.Element; x: number }[] {
  return elements.flatMap((element) => [
    { element, x },
    ...(element instanceof Drawing.Group
      ? positioned(element.children, x + element.position.x)
      : []),
  ]);
}

test.each([LayoutType.Horizontal, LayoutType.Vertical, LayoutType.Page])(
  "keeps notes clear of every barline in layout %s",
  (layoutType) => {
    const score = Engraving.Score.import(
      Core.Score.create({
        tracks: [
          {
            notes: Array.from({ length: 32 }, (_, index) => ({
              pitch: index % 2 === 0 ? 60 : 84,
              start: index / 2,
              duration: 0.5,
            })),
          },
        ],
      })
        .toSheet()
        .export(),
    );
    const controller = new Engraving.Controller(score, {
      layoutType,
      scale: 12,
      advanced: true,
      debug: false,
      viewportWidth: 480,
      pageLayout: { width: 48, height: 80, margin: 4 },
    });
    controller.mount();
    const drawing = controller.toDocument();
    const elements = drawing.pages.flatMap((page) => positioned(page.elements));
    for (const bar of score.masterbars) {
      const content = elements.filter(
        ({ element }) =>
          element.source?.barId === bar.id &&
          element instanceof Drawing.Glyph &&
          (element.source?.noteId !== undefined ||
            element.role === "flag" ||
            element.glyphName === "legerLine"),
      );
      expect(content.length).toBeGreaterThan(0);
      const right = Math.max(
        ...content.map(({ element, x }) => {
          const glyph = element as Drawing.Glyph;
          return x + glyph.bounds.x + glyph.bounds.width;
        }),
      );
      const boundary = elements.find(
        ({ element }) =>
          element.role === "masterbar" && element.source?.barId === bar.id,
      )!;
      const group = boundary.element as Drawing.Group;
      const barlineInset = bar.isLast ? 0.5 : 0;
      expect(right).toBeLessThan(
        boundary.x + group.position.x + bar.width - barlineInset,
      );
    }
    expect(controller.toDocument()).toEqual(drawing);
    controller.unmount();
  },
);
