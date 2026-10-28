// @vitest-environment node
import { expect, test } from "vitest";
import * as Core from "../core";
import "../core/extensions/to-sheet";
import * as Drawing from "../document";
import { LayoutType } from "../sheet";
import * as Engraving from ".";

function flatten(elements: readonly Drawing.Element[]): Drawing.Element[] {
  return elements.flatMap((element) => [
    element,
    ...(element instanceof Drawing.Group ? flatten(element.children) : []),
  ]);
}

test.each([1, 3, 5])(
  "centers the percussion clef on a %s-line staff",
  (lines) => {
    const score = Engraving.Score.import(
      Core.Score.create({
        tracks: [{ preset: 40, notes: [{ pitch: 60, start: 0, duration: 4 }] }],
      })
        .toSheet()
        .export(),
    );
    // Exercise the clef independently of pitched or unpitched note rendering.
    score.notes = [];
    score.chords = [];
    // Explicit mutations require rebuilding the private relation index.
    score.rebuildLayoutIndex();
    score.tracks[0].staffDetails = { "staff-lines": [{ _: lines }] };
    for (const stave of score.staves)
      stave.clefs = [{ sign: [{ _: "percussion" }] }];
    const controller = new Engraving.Controller(score, {
      layoutType: LayoutType.Horizontal,
      scale: 12,
      debug: false,
      advanced: true,
    });
    controller.mount();
    const drawing = controller.toDocument();
    const clef = flatten(drawing.pages[0].elements).find(
      (element) =>
        element instanceof Drawing.Glyph &&
        element.glyphName === "unpitchedPercussionClef1",
    ) as Drawing.Glyph;
    expect(clef).toBeDefined();
    expect(clef.bounds.y + clef.bounds.height / 2).toBeCloseTo((lines - 1) / 2);
    expect(controller.toDocument()).toEqual(drawing);
    controller.unmount();
  },
);
