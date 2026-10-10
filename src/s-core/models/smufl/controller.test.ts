// @vitest-environment node
import { describe, expect, test } from "vitest";
import * as Core from "../core";
import "../core/extensions/to-sheet";
import * as Drawing from "../document";
import { LayoutType } from "../sheet";
import * as SMUFL from ".";

function prepare(layoutType: LayoutType, noteCount = 64) {
  const score: SMUFL.Score = SMUFL.Score.import(
    Core.Score.create({
      tracks:
        noteCount === 0
          ? []
          : [
              {
                notes: Array.from({ length: noteCount }, (_, start) => ({
                  pitch: 60,
                  start,
                  duration: 1,
                })),
              },
            ],
    })
      .toSheet()
      .export(),
  );
  const controller = new SMUFL.Controller(score, {
    layoutType,
    scale: 12,
    advanced: true,
    debug: false,
    viewportWidth: 240,
    pageLayout: { width: 36, height: 40, margin: 6 },
  });
  controller.mount();
  return { score, controller };
}

function flatten(elements: readonly Drawing.Element[]): Drawing.Element[] {
  return elements.flatMap((element) => [
    element,
    ...(element instanceof Drawing.Group ? flatten(element.children) : []),
  ]);
}

describe("score drawing layouts", () => {
  test("horizontal scrolling keeps all bars in a single system and page", () => {
    const { score, controller } = prepare(LayoutType.Horizontal);
    const drawing = controller.toDocument();
    expect(score.rows).toHaveLength(1);
    expect(drawing.pages).toHaveLength(1);
    expect(drawing.pages[0].width).toBe(score.width);
    expect(score.rows[0].masterbars).toHaveLength(score.masterbars.length);
  });

  test("vertical scrolling wraps complete bars and repeats the clef on each system", () => {
    const { score, controller } = prepare(LayoutType.Vertical);
    const drawing = controller.toDocument();
    expect(drawing.pages).toHaveLength(1);
    expect(score.rows.length).toBeGreaterThan(1);
    for (const [index, row] of score.rows.entries()) {
      expect(row.masterbars.length).toBeGreaterThan(0);
      expect(row.width).toBeLessThanOrEqual(controller.layoutWidth);
      expect(row.masterbars[0].bars[0].staves[0].word.width).toBeGreaterThan(0);
      if (index > 0)
        expect(row.y).toBeGreaterThan(
          score.rows[index - 1].y + score.rows[index - 1].height,
        );
    }
    expect(drawing.pages[0].height).toBe(
      score.rows.at(-1)!.y + score.rows.at(-1)!.height,
    );
    controller.options.viewportWidth = 480;
    const originalRowCount = score.rows.length;
    controller.toDocument();
    expect(score.rows.length).toBeLessThan(originalRowCount);
  });

  test("page layout keeps every note and bar exactly once across fixed size pages", () => {
    const { score, controller } = prepare(LayoutType.Page);
    const drawing = controller.toDocument();
    expect(drawing.pages.length).toBeGreaterThan(1);
    const all = drawing.pages.flatMap((page) => flatten(page.elements));
    expect(all.filter((element) => element.role === "note")).toHaveLength(
      score.notes.length,
    );
    expect(
      all
        .filter((element) => element.role === "masterbar")
        .map((element) => element.source?.barId),
    ).toEqual(score.masterbars.map((bar) => bar.id));
    for (const page of drawing.pages) {
      expect(page.width).toBe(36);
      expect(page.height).toBe(40);
      for (const element of page.elements) {
        const row = element as Drawing.Group;
        const system = score.rows.find(
          (system) => system.id === row.source?.rowId,
        )!;
        expect(row.position.x).toBe(6);
        expect(row.position.y).toBeGreaterThanOrEqual(6);
        expect(row.position.y + system.height).toBeLessThanOrEqual(34);
      }
    }
    const again = controller.toDocument();
    expect(again).toEqual(drawing);
    controller.options.scale = 24;
    expect(controller.toDocument()).toEqual(drawing);
    controller.options.layoutType = LayoutType.Horizontal;
    expect(controller.toDocument().pages).toHaveLength(1);
    expect(score.rows).toHaveLength(1);
    controller.options.layoutType = LayoutType.Page;
    expect(controller.toDocument()).toEqual(drawing);
  });

  test("an oversized bar remains on a nonempty page and stays visible", () => {
    const { score, controller } = prepare(LayoutType.Page, 4);
    controller.options.pageLayout = { width: 2, height: 2, margin: 0.5 };
    const drawing = controller.toDocument();
    expect(score.rows).toHaveLength(1);
    expect(drawing.pages).toHaveLength(1);
    expect(drawing.pages[0].elements).toHaveLength(1);
    expect(drawing.pages[0].width).toBeGreaterThanOrEqual(score.width + 1);
    expect(drawing.pages[0].height).toBeGreaterThanOrEqual(score.height + 1);
  });

  test("page layout uses the available screen size without a browser", () => {
    const { controller } = prepare(LayoutType.Page, 1);
    controller.options.pageLayout = undefined;
    controller.options.viewportWidth = 480;
    controller.options.viewportHeight = 360;
    const drawing = controller.toDocument();
    expect(drawing.pages[0].width).toBe(480 / 12);
    expect(drawing.pages[0].height).toBe(360 / 12);
  });

  test("screen pages adjust to height, width and zoom while keeping all notes", () => {
    const { score, controller } = prepare(LayoutType.Page);
    controller.options.pageLayout = undefined;
    controller.options.viewportWidth = 480;
    controller.options.viewportHeight = 480;
    const initial = controller.toDocument();
    controller.options.viewportHeight = 240;
    const shorter = controller.toDocument();
    expect(shorter.pages.length).toBeGreaterThan(initial.pages.length);
    controller.options.viewportWidth = 360;
    const narrower = controller.toDocument();
    expect(narrower.pages.length).toBeGreaterThan(shorter.pages.length);
    controller.options.viewportWidth = 480;
    controller.options.viewportHeight = 480;
    controller.options.scale = 24;
    const zoomed = controller.toDocument();
    expect(zoomed.pages.length).toBeGreaterThan(initial.pages.length);
    for (const drawing of [initial, shorter, narrower, zoomed]) {
      const notes = drawing.pages
        .flatMap((page) => flatten(page.elements))
        .filter((element) => element.role === "note");
      expect(notes).toHaveLength(score.notes.length);
    }
  });

  test("an empty score still has a page in page mode", () => {
    const { controller } = prepare(LayoutType.Page, 0);
    const drawing = controller.toDocument();
    expect(drawing.pages).toHaveLength(1);
    expect(drawing.pages[0].width).toBe(36);
    expect(drawing.pages[0].height).toBe(40);
  });
});

test.each([1, 4, 17, 64])(
  "page rows fill the usable width with %s notes, including the final row",
  (count) => {
    const { score, controller } = prepare(LayoutType.Page, count);
    controller.toDocument();
    for (const row of score.rows) {
      expect(row.width).toBeCloseTo(controller.layoutWidth);
      expect(row.masterbars.at(-1)!.right).toBeCloseTo(controller.layoutWidth);
      for (const bar of row.masterbars) {
        expect(bar.width).toBeGreaterThanOrEqual(bar.minWidth);
        const stave = bar.bars[0].staves[0];
        const slots = stave.slots;
        expect(stave.width).toBeCloseTo(bar.width);
        expect(
          slots.at(-1)!.x + slots.at(-1)!.width + stave.word.width,
        ).toBeCloseTo(bar.width);
      }
    }
  },
);

test("page spacing is repeatable, adjusts on resize and resets in scrolling layouts", () => {
  const { score, controller } = prepare(LayoutType.Page, 4);
  controller.toDocument();
  const positions = score.slots.map((slot) => slot.x);
  const naturalWidth = score.rows[0].minWidth;
  expect(score.slots[1].x).toBeGreaterThan(score.slots[0].minWidth);
  controller.toDocument();
  expect(score.slots.map((slot) => slot.x)).toEqual(positions);
  controller.options.pageLayout = { width: 60, height: 40, margin: 6 };
  controller.toDocument();
  expect(score.rows[0].width).toBeCloseTo(48);
  expect(score.slots[1].x).toBeGreaterThan(positions[1]);
  for (const layoutType of [LayoutType.Horizontal, LayoutType.Vertical]) {
    controller.options.layoutType = layoutType;
    controller.toDocument();
    expect(score.slots.every((slot) => slot.spacing === 0)).toBe(true);
    expect(score.rows[0].width).toBeCloseTo(naturalWidth);
  }
});

test("page spacing keeps simultaneous notes aligned across tracks and piano staves", () => {
  const notes = Array.from({ length: 4 }, (_, start) => ({
    pitch: 60,
    start,
    duration: 1,
  }));
  const score = SMUFL.Score.import(
    Core.Score.create({
      tracks: [
        { preset: 40, notes },
        { preset: 0, notes: notes.map((note) => ({ ...note, pitch: 48 })) },
      ],
    })
      .toSheet()
      .export(),
  );
  const controller = new SMUFL.Controller(score, {
    layoutType: LayoutType.Page,
    scale: 12,
    advanced: true,
    debug: false,
    pageLayout: { width: 60, height: 60, margin: 6 },
  });
  controller.mount();
  const drawing = controller.toDocument();
  expect(score.rows[0].width).toBeCloseTo(48);
  const slotGroups = flatten(drawing.pages[0].elements).filter(
    (element): element is Drawing.Group =>
      element instanceof Drawing.Group && element.role === "slot",
  );
  for (let beat = 0; beat < 4; beat++) {
    const groups = slotGroups.filter((_, index) => index % 4 === beat);
    expect(new Set(groups.map((group) => group.position.x)).size).toBe(1);
  }
});
