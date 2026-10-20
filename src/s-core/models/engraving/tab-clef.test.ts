import { expect, test } from "vitest";
import * as Core from "../core";
import "../core/extensions/to-sheet";
import * as Drawing from "../document";
import "../document/extensions/to-svg";
import { ElementType, LayoutType } from "../sheet";
import * as Engraving from ".";

function flatten(elements: readonly Drawing.Element[]): Drawing.Element[] {
  return elements.flatMap((element) => [
    element,
    ...(element instanceof Drawing.Group ? flatten(element.children) : []),
  ]);
}

test.each([4, 6])("fits the TAB clef inside a %s-string staff", (lines) => {
  const score = Engraving.Score.import(
    Core.Score.create({
      tracks: [{ preset: 40, notes: [{ pitch: 60, start: 0, duration: 4 }] }],
    })
      .toSheet()
      .export(),
  );
  score.notes = [];
  score.chords = [];
  score.tracks[0].staffDetails = { "staff-lines": [{ _: lines }] };
  for (const stave of score.staves) stave.clefs = [{ sign: [{ _: "TAB" }] }];
  const controller = new Engraving.Controller(score, {
    layoutType: LayoutType.Horizontal,
    scale: 12,
    debug: false,
    advanced: true,
  });
  controller.mount();
  // Select the matching font glyph independently of TAB note import support.
  const word = score.staves[0].word;
  const column = word.glyphOrLigatureLists[0];
  column[0] = new Engraving.Glyph(
    lines === 4 ? "4stringTabClef" : "6stringTabClef",
    ElementType.Clef,
    0,
  );
  // layout() rebuilds the header, so use the drawn score directly after ordering.
  controller.order();
  const drawing = score.toDocument();
  const clef = flatten(drawing.pages[0].elements).find(
    (element) =>
      element instanceof Drawing.Glyph &&
      element.glyphName?.includes("TabClef"),
  ) as Drawing.Glyph;
  expect(clef).toBeDefined();
  expect(clef.bounds.y).toBeCloseTo(0);
  expect(clef.bounds.height).toBeCloseTo(lines - 1);
  expect(clef.bounds.y + clef.bounds.height / 2).toBeCloseTo((lines - 1) / 2);
  expect(clef.fontScale).toBeLessThanOrEqual(1);
  const text = drawing
    .toSVG()
    .querySelector(`[data-glyph-name="${clef.glyphName}"] text`)!;
  expect(text.getAttribute("font-size")).toBe(`${clef.fontScale}em`);
  expect(Number(text.getAttribute("y"))).toBeCloseTo(clef.position.y);
  expect(score.toDocument()).toEqual(drawing);
  controller.unmount();
});
