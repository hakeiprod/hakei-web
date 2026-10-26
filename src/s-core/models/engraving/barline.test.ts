// @vitest-environment node
import { expect, test } from "vitest";
import * as Core from "../core";
import "../core/extensions/to-sheet";
import * as Drawing from "../document";
import { LayoutType } from "../sheet";
import * as Engraving from ".";
import BravuraMetadata from "../../const/bravura/bravura_metadata.json";

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

test.each(
  [LayoutType.Horizontal, LayoutType.Vertical, LayoutType.Page].flatMap(
    (layoutType) =>
      [
        { name: "quarter", duration: 1, rest: false, stem: "up" as const },
        { name: "flag up", duration: 0.5, rest: false, stem: "up" as const },
        {
          name: "flag down",
          duration: 0.5,
          rest: false,
          stem: "down" as const,
        },
        { name: "dotted", duration: 1.5, rest: false, stem: "up" as const },
        { name: "rest", duration: 1, rest: true, stem: "none" as const },
        { name: "whole", duration: 4, rest: false, stem: "none" as const },
      ].map((sample) => ({ layoutType, ...sample })),
  ),
)(
  "keeps $name clear of every barline in layout $layoutType",
  ({ layoutType, duration, rest, stem }) => {
    const score = Engraving.Score.import(
      Core.Score.create({
        timesignatures: [
          { numerator: duration === 1.5 ? 3 : 4, denominator: 4, start: 0 },
        ],
        tracks: [
          {
            notes: Array.from({ length: 16 }, (_, index) => ({
              pitch: index % 2 === 0 ? 60 : 84,
              start: index * duration,
              duration,
            })),
          },
        ],
      })
        .toSheet()
        .export(),
    );
    for (const note of score.notes) {
      note.rest = rest;
      note.stem = { _: stem };
    }
    score.beamGroups = [];
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
      const ending = elements.find(
        ({ element }) =>
          element.source?.barId === bar.id &&
          (element.role === "barline-end-thin" ||
            element.role === "barline-end"),
      );
      const line = ending?.element as Drawing.Line | undefined;
      const left =
        ending && line
          ? ending.x + line.start.x - line.strokeWidth / 2
          : boundary.x + group.position.x + bar.width;
      expect(right).toBeLessThan(left);
    }
    expect(controller.toDocument()).toEqual(drawing);
    controller.unmount();
  },
);

test("recomputes the bar width from changed SMuFL ledger-line bounds", () => {
  const score = Engraving.Score.import(
    Core.Score.create({
      tracks: [
        {
          notes: Array.from({ length: 4 }, (_, start) => ({
            pitch: start === 3 ? 60 : 64,
            start,
            duration: 1,
          })),
        },
      ],
    })
      .toSheet()
      .export(),
  );
  const controller = new Engraving.Controller(score, {
    layoutType: LayoutType.Horizontal,
    scale: 12,
    advanced: true,
    debug: false,
  });
  controller.mount();
  const before = controller.toDocument();
  const width = before.pages[0].width;
  const ledger = score.chords
    .at(-1)!
    .legerlinesLigature.glyphLists.flat()[0] as Engraving.Glyph;
  // Simulate a font with a wider ledger line, without changing the notehead.
  const extension = ledger.glyphAdvanceWidth;
  ledger.glyphBBox.width += extension;
  const after = controller.toDocument();
  expect(after.pages[0].width - width).toBeCloseTo(extension);
  const elements = positioned(after.pages[0].elements);
  const end = elements.find(
    ({ element }) => element.role === "barline-end-thin",
  )!;
  const line = end.element as Drawing.Line;
  const ledgerInk = elements.filter(
    ({ element }) =>
      element instanceof Drawing.Glyph && element.glyphName === "legerLine",
  );
  expect(ledgerInk.length).toBeGreaterThan(0);
  for (const { element, x } of ledgerInk) {
    const glyph = element as Drawing.Glyph;
    expect(x + glyph.bounds.x + glyph.bounds.width).toBeLessThan(
      end.x + line.start.x - line.strokeWidth / 2,
    );
  }
  expect(controller.toDocument()).toEqual(after);
  controller.unmount();
});

test.each([undefined, 0, 0.7])(
  "uses the metadata gap between final barline ink edges (%s)",
  (separation) => {
    const defaults = BravuraMetadata.engravingDefaults;
    const metadata = defaults as typeof defaults & {
      thinThickBarlineSeparation?: number;
    };
    const previous = metadata.thinThickBarlineSeparation;
    metadata.thinThickBarlineSeparation = separation;
    const score = Engraving.Score.import(
      Core.Score.create({
        tracks: [{ notes: [{ pitch: 60, start: 0, duration: 4 }] }],
      })
        .toSheet()
        .export(),
    );
    const controller = new Engraving.Controller(score, {
      layoutType: LayoutType.Horizontal,
      scale: 12,
      advanced: true,
      debug: false,
    });
    try {
      controller.mount();
      const elements = positioned(controller.toDocument().pages[0].elements);
      const thin = elements.find(
        ({ element }) => element.role === "barline-end-thin",
      )!.element as Drawing.Line;
      const thick = elements.find(
        ({ element }) => element.role === "barline-end-thick",
      )!.element as Drawing.Line;
      expect(
        thick.start.x -
          thick.strokeWidth / 2 -
          (thin.start.x + thin.strokeWidth / 2),
      ).toBeCloseTo(separation ?? defaults.barlineSeparation);
    } finally {
      if (previous === undefined) delete metadata.thinThickBarlineSeparation;
      else metadata.thinThickBarlineSeparation = previous;
      controller.unmount();
    }
  },
);
