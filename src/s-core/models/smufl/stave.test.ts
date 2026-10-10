// @vitest-environment node
import { describe, expect, test } from "vitest";
import * as Core from "../core";
import "../core/extensions/to-sheet";
import * as Drawing from "../document";
import { LayoutType } from "../sheet";
import * as SMUFL from ".";

function prepare(
  data: Parameters<typeof Core.Score.create>[0],
  layoutType = LayoutType.Horizontal,
) {
  const score = SMUFL.Score.import(Core.Score.create(data).toSheet().export());
  const controller = new SMUFL.Controller(score, {
    layoutType,
    scale: 12,
    debug: false,
    advanced: true,
    viewportWidth: 240,
    viewportHeight: 480,
  });
  controller.mount();
  return controller;
}

function flatten(elements: readonly Drawing.Element[]): Drawing.Element[] {
  return elements.flatMap((element) => [
    element,
    ...(element instanceof Drawing.Group ? flatten(element.children) : []),
  ]);
}

function glyphs(document: Drawing.Document) {
  return document.pages
    .flatMap((page) => flatten(page.elements))
    .filter(
      (element): element is Drawing.Glyph => element instanceof Drawing.Glyph,
    );
}

describe("stave signatures", () => {
  test.each([60, 48])(
    "leaves the time signature's advance after the clef for pitch %s",
    (pitch) => {
      const controller = prepare({
        tracks: [{ notes: [{ pitch, start: 0, duration: 1 }] }],
      });
      const elements = flatten(controller.toDocument().pages[0].elements);
      const word = elements.find(
        (element) => element.role === "word",
      ) as Drawing.Group;
      const clef = word.children.find(
        (element) => element instanceof Drawing.Glyph,
      ) as Drawing.Glyph;
      const signature = word.children.find(
        (element) =>
          element instanceof Drawing.Group &&
          element.children.some(
            (glyph) =>
              glyph instanceof Drawing.Glyph &&
              glyph.glyphName?.startsWith("timeSig"),
          ),
      ) as Drawing.Group;
      for (const glyph of signature.children as Drawing.Glyph[]) {
        const gap =
          signature.position.x +
          glyph.bounds.x -
          (clef.bounds.x + clef.bounds.width);
        expect(gap).toBeGreaterThanOrEqual(glyph.advanceWidth);
      }
      controller.unmount();
    },
  );

  test.each([LayoutType.Horizontal, LayoutType.Vertical, LayoutType.Page])(
    "renders changed time signatures exactly once in layout %s",
    (layout) => {
      const controller = prepare(
        {
          tracks: [
            {
              notes: Array.from({ length: 10 }, (_, start) => ({
                pitch: 60,
                start,
                duration: 1,
              })),
            },
          ],
          timesignatures: [
            { numerator: 4, denominator: 4, start: 0 },
            { numerator: 3, denominator: 4, start: 4 },
            { numerator: 3, denominator: 4, start: 7 },
          ],
        },
        layout,
      );
      const drawing = controller.toDocument();
      const signatures = glyphs(drawing).filter((glyph) =>
        glyph.glyphName?.startsWith("timeSig"),
      );
      expect(
        signatures.map((glyph) => [glyph.source?.barId, glyph.glyphName]),
      ).toEqual([
        [0, "timeSig4"],
        [0, "timeSig4"],
        [1, "timeSig3"],
        [1, "timeSig4"],
      ]);
      expect(controller.toDocument()).toEqual(drawing);
      controller.unmount();
    },
  );

  test("renders a denominator-only change on every track and piano staff", () => {
    const controller = prepare({
      tracks: [
        {
          notes: [48, 60].flatMap((pitch) =>
            Array.from({ length: 6 }, (_, start) => ({
              pitch,
              start,
              duration: 1,
            })),
          ),
        },
        {
          notes: Array.from({ length: 6 }, (_, start) => ({
            pitch: 72,
            start,
            duration: 1,
          })),
        },
      ],
      timesignatures: [
        { numerator: 4, denominator: 4, start: 0 },
        { numerator: 4, denominator: 8, start: 4 },
      ],
    });
    const changed = glyphs(controller.toDocument()).filter(
      (glyph) =>
        glyph.source?.barId === 1 && glyph.glyphName?.startsWith("timeSig"),
    );
    expect(changed).toHaveLength(6);
    for (const [trackId, staveId] of [
      [0, 0],
      [0, 1],
      [1, 0],
    ])
      expect(
        changed
          .filter(
            (glyph) =>
              glyph.source?.trackId === trackId &&
              glyph.source?.staveId === staveId,
          )
          .map((glyph) => glyph.glyphName),
      ).toEqual(["timeSig4", "timeSig8"]);
    controller.unmount();
  });

  test.each([
    {
      accidental: 5 as const,
      tonality: Core.Enums.Tonality.Major,
      name: "accidentalSharp",
    },
    {
      accidental: 2 as const,
      tonality: Core.Enums.Tonality.Minor,
      name: "accidentalSharp",
    },
    {
      accidental: -2 as const,
      tonality: Core.Enums.Tonality.Major,
      name: "accidentalFlat",
    },
    {
      accidental: -3 as const,
      tonality: Core.Enums.Tonality.Minor,
      name: "accidentalFlat",
    },
  ])(
    "places $name symbols without adding their advance twice ($tonality, $accidental)",
    ({ accidental, tonality, name }) => {
      const controller = prepare({
        tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }],
        keysignatures: [{ accidental, tonality }],
      });
      const drawing = controller.toDocument();
      const accidentals = glyphs(drawing).filter(
        (glyph) => glyph.glyphName === name,
      );
      expect(accidentals).toHaveLength(Math.abs(accidental));
      for (let index = 1; index < accidentals.length; index++) {
        const previous = accidentals[index - 1];
        const current = accidentals[index];
        expect(current.position.x - previous.position.x).toBeCloseTo(
          previous.bounds.width,
        );
        expect(current.bounds.x).toBeCloseTo(
          previous.bounds.x + previous.bounds.width,
        );
      }
      expect(controller.toDocument()).toEqual(drawing);
      controller.unmount();
    },
  );
});
