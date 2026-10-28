/// <reference types="vite/client" />
import { describe, expect, test, vi } from "vitest";
import * as Core from "../core";
import "../core/extensions/to-sheet";
import { LayoutType } from "../sheet";
import * as Engraving from "../engraving";
import "../document/extensions/to-svg";
import { bindNoteHighlights } from "./bind-note-highlights";

const fixtures = import.meta.glob("../../fixtures/core/*.json", {
  eager: true,
  import: "default",
}) as Record<string, Parameters<typeof Core.Score.create>[0]>;
function prepare(data: Parameters<typeof Core.Score.create>[0]) {
  const score: Engraving.Score = Engraving.Score.import(
    Core.Score.create(structuredClone(data)).toSheet().export(),
  );
  const controller = new Engraving.Controller(score, {
    scale: 12,
    layoutType: LayoutType.Horizontal,
    debug: false,
    advanced: true,
  });
  controller.mount();
  return { score, controller };
}

function renderSVG(controller: Engraving.Controller) {
  const drawing = controller.toDocument();
  const svg = drawing.toSVG({
    scale: controller.options.scale,
    paddingBottom: 100,
  });
  bindNoteHighlights(controller.score, svg);
  return svg;
}

function glyph(svg: SVGSVGElement, trackId: number) {
  return svg.querySelector(
    `[type="note"][data-track-id="${trackId}"][data-note-id="0"] [type="glyph"]`,
  )!;
}

describe("Engraving through Document to SVG", () => {
  test("exposes SVG rendering on Document while Engraving produces only Document", () => {
    expect("toSVG" in Engraving.Score.prototype).toBe(false);
    expect("render" in Engraving.Controller.prototype).toBe(false);
    expect(typeof Engraving.Score.prototype.toDocument).toBe("function");
  });
  test.each(Object.entries(fixtures))(
    "renders fixture %s through Document",
    (_name, fixture) => {
      const { score, controller } = prepare(fixture);
      const svg = renderSVG(controller);
      expect(svg.namespaceURI).toBe("http://www.w3.org/2000/svg");
      expect(svg.outerHTML).not.toMatch(/NaN|Infinity/);
      expect(svg.querySelectorAll('[type="note"]')).toHaveLength(
        score.notes.length,
      );
      for (const note of score.notes)
        expect(
          svg.querySelector(
            `[type="note"][data-track-id="${note.trackId}"][data-note-id="${note.id}"]`,
          ),
        ).not.toBeNull();
      controller.unmount();
    },
  );

  test("updates the latest SVG after re-rendering and keeps tracks separate", () => {
    const { score, controller } = prepare({
      tracks: [
        { notes: [{ pitch: 60, start: 0, duration: 1 }] },
        { notes: [{ pitch: 64, start: 0, duration: 1 }] },
      ],
    });
    const first = renderSVG(controller);
    const note = score.notes.find((note) => !note.rest)!;
    note.glyph.setClassName(["note-highlight"]);
    expect(glyph(first, 0).getAttribute("class")).toBe("note-highlight");
    expect(glyph(first, 1).getAttribute("class")).not.toBe("note-highlight");
    const second = renderSVG(controller);
    expect(glyph(second, 0).getAttribute("class")).toBe("note-highlight");
    note.glyph.setClassName([]);
    expect(glyph(second, 0).getAttribute("class")).toBe("");
    expect(glyph(first, 0).getAttribute("class")).toBe("note-highlight");
    controller.unmount();
  });

  test("debug is optional and disabled structured options produce no bounds", () => {
    const { controller } = prepare({
      tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }],
    });
    controller.options.debug = { enabled: false, showBoundingBox: true };
    expect(
      renderSVG(controller).querySelectorAll("[data-debug-bounds]"),
    ).toHaveLength(0);
    controller.options.debug = true;
    expect(
      renderSVG(controller).querySelectorAll("[data-debug-bounds]").length,
    ).toBeGreaterThan(0);
    controller.unmount();
  });
});

test.each(["up", "down"] as const)(
  "renders anchored %s stems and dotted eighth-note flags through Document",
  (direction) => {
    const { score, controller } = prepare({
      tracks: [{ notes: [{ pitch: 60, start: 0, duration: 0.75 }] }],
    });
    score.notes[0].stem = { _: direction };
    const svg = renderSVG(controller);
    const notehead = svg.querySelector<SVGTextElement>(
      '[type="note"] [type="glyph"] text',
    )!;
    const stem = svg.querySelector<SVGLineElement>('[type="stem"]')!;
    const flag = svg.querySelector<SVGGElement>('[type="flag"]')!;
    const flagText = flag.querySelector("text")!;
    const thickness = Number(stem.getAttribute("stroke-width"));
    const noteX = Number(notehead.getAttribute("x"));
    const noteY = Number(notehead.getAttribute("y"));
    expect(Number(stem.getAttribute("x1"))).toBeCloseTo(
      noteX + (direction === "up" ? 1.18 - thickness / 2 : thickness / 2),
    );
    expect(Number(stem.getAttribute("y1"))).toBeCloseTo(
      noteY + (direction === "up" ? -0.168 : 0.168),
    );
    expect(Number(flagText.getAttribute("x"))).toBeCloseTo(
      Number(stem.getAttribute("x2")) - thickness / 2,
    );
    expect(Number(stem.getAttribute("y2"))).toBeCloseTo(
      Number(flagText.getAttribute("y")) - (direction === "up" ? -0.04 : 0.132),
    );
    expect(flag.dataset.glyphName).toBe(
      direction === "up" ? "flag8thUp" : "flag8thDown",
    );
    expect(flagText.textContent).toBe(
      String.fromCodePoint(direction === "up" ? 0xe2_40 : 0xe2_41),
    );
    expect(
      svg.querySelectorAll(
        '[data-glyph-name="augmentationDot"][data-track-id="0"][data-note-id="0"]',
      ),
    ).toHaveLength(1);
    controller.unmount();
  },
);

function drawingOrigin(element: SVGElement) {
  const origin = { x: 0, y: 0 };
  for (
    let parent = element.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    const translation = parent
      .getAttribute("transform")
      ?.match(/^translate\(([^,]+), ([^)]+)\)$/);
    if (translation) {
      origin.x += Number(translation[1]);
      origin.y += Number(translation[2]);
    }
  }
  return origin;
}

test.each([
  { pitches: [60, 60, 60], durations: [0.25, 0.25, 0.25] },
  { pitches: [60, 64, 62], durations: [0.25, 0.25, 0.25] },
  { pitches: [64, 60, 62], durations: [0.25, 0.25, 0.25] },
  { pitches: [60, 64], durations: [0.25, 0.75] },
  { pitches: [64, 60], durations: [0.75, 0.25] },
])(
  "beam rectangles stay inside stems for $pitches and $durations",
  ({ pitches, durations }) => {
    for (const direction of ["up", "down"] as const) {
      let start = 0;
      const { score, controller } = prepare({
        tracks: [
          {
            notes: pitches.map((pitch, index) => {
              const note = { pitch, start, duration: durations[index] };
              start += durations[index];
              return note;
            }),
          },
        ],
      });
      for (const note of score.notes)
        if (!note.rest) note.stem = { _: direction };
      const svg = renderSVG(controller);
      const beams = [
        ...svg.querySelectorAll<SVGRectElement>('rect[type="beam"]'),
      ];
      const stems = [
        ...svg.querySelectorAll<SVGLineElement>('line[type="stem"]'),
      ].map((stem) => {
        const origin = drawingOrigin(stem);
        return {
          x: Number(stem.getAttribute("x2")) + origin.x,
          y: Number(stem.getAttribute("y2")) + origin.y,
          thickness: Number(stem.getAttribute("stroke-width")),
        };
      });
      expect(beams).toHaveLength(2);
      expect(stems).toHaveLength(pitches.length);
      expect(
        svg.querySelector('line[type="beam"], path[type="beam"]'),
      ).toBeNull();
      const first = stems[0];
      const last = stems.at(-1)!;
      for (const beam of beams) {
        const origin = drawingOrigin(beam);
        const x = Number(beam.getAttribute("x")) + origin.x;
        const width = Number(beam.getAttribute("width"));
        expect(width).toBeGreaterThan(0);
        expect(x).toBeGreaterThanOrEqual(first.x - first.thickness / 2);
        expect(x + width).toBeLessThanOrEqual(last.x + last.thickness / 2);
        expect(beam.getAttribute("fill")).toBe("black");
        expect(beam.getAttribute("stroke")).toBe("none");
        expect(beam.dataset.trackId).toBe("0");
      }
      const primary = beams[0];
      const origin = drawingOrigin(primary);
      const x = Number(primary.getAttribute("x")) + origin.x;
      const y =
        Number(primary.getAttribute("y")) +
        Number(primary.getAttribute("height")) / 2 +
        origin.y;
      const slope = Number(
        primary.getAttribute("transform")!.slice(7, -1).split(" ")[1],
      );
      for (const stem of stems)
        expect(y + slope * (stem.x - x)).toBeCloseTo(stem.y);
      expect(svg.outerHTML).not.toMatch(/NaN|Infinity/);
      controller.unmount();
    }
  },
);

test("cooperative SVG preserves bytes and prepares highlights without touching committed bindings", async () => {
  const { drainCooperatively } = await import("./render-scheduler");
  const { prepareNoteHighlightsSteps } = await import("./bind-note-highlights");
  const { score, controller } = prepare({
    tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }],
  });
  const drawing = controller.toDocument();
  const expected = drawing.toSVG({ scale: 12 }).outerHTML;
  const next = await drainCooperatively(drawing.toSVGSteps({ scale: 12 }), {
    budgetMs: 1,
  });
  expect(next.outerHTML).toBe(expected);
  const committed = renderSVG(controller),
    note = score.notes.find((note) => !note.rest)!;
  const previous = note.glyph.onClassListChange;
  const prepared = await drainCooperatively(
    prepareNoteHighlightsSteps(score, next),
  );
  expect(note.glyph.onClassListChange === previous).toBe(true);
  prepared.activate();
  note.glyph.setClassName(["note-highlight"]);
  expect(glyph(next, 0).getAttribute("class")).toBe("note-highlight");
  expect(glyph(committed, 0).getAttribute("class")).not.toBe("note-highlight");
  prepared.dispose();
  expect(note.glyph.onClassListChange).toBeUndefined();
});

test.each(["cancel", "failure"] as const)(
  "a %s job cannot replace committed glyph callbacks, and retry binds only the new score",
  async (outcome) => {
    const { createSourceSnapshot, renderScore } =
      await import("./render-score");
    const source = await createSourceSnapshot(
      Core.Score.create({
        tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }],
      })
        .toSheet()
        .export(),
    );
    const options = {
      scale: 12,
      layoutType: LayoutType.Horizontal,
      advanced: true,
      debug: false,
    };
    const oldScroll = vi.fn(),
      nextScroll = vi.fn();
    const old = await renderScore(source, options, { onHighlight: oldScroll });
    const oldSVG = old.selectPage(0).svg;
    const oldNote = old.score.notes.find((note) => !note.rest)!;
    const callback = oldNote.glyph.onClassListChange;
    const abort = new AbortController();
    let next: Awaited<ReturnType<typeof renderScore>> | undefined;
    try {
      await expect(
        renderScore(source, options, {
          signal: abort.signal,
          onHighlight: nextScroll,
          onStage: (stage) => {
            if (stage !== "highlights") return;
            if (outcome === "cancel") abort.abort();
            else throw new Error("binding preparation failed");
          },
        }),
      ).rejects.toThrow(
        outcome === "cancel" ? /aborted/i : /preparation failed/,
      );
      expect(oldNote.glyph.onClassListChange).toBe(callback);
      oldNote.glyph.setClassName(["note-highlight"]);
      expect(glyph(oldSVG, 0).getAttribute("class")).toBe("note-highlight");
      expect(oldScroll).toHaveBeenCalledOnce();
      expect(nextScroll).not.toHaveBeenCalled();
      next = await renderScore(source, options, { onHighlight: nextScroll });
      const nextSVG = next.selectPage(0).svg;
      old.dispose();
      const previousHTML = oldSVG.outerHTML;
      oldScroll.mockClear();
      oldNote.glyph.setClassName(["retired-note"]);
      const currentNote = next.score.notes.find((note) => !note.rest)!;
      currentNote.glyph.setClassName(["note-highlight"]);
      expect(nextScroll).toHaveBeenCalledOnce();
      expect(oldScroll).not.toHaveBeenCalled();
      expect(oldNote.glyph.onClassListChange).toBeUndefined();
      expect(oldSVG.outerHTML).toBe(previousHTML);
      expect(nextSVG.querySelector(".retired-note")).toBeNull();
      expect(glyph(nextSVG, 0).getAttribute("class")).toBe("note-highlight");
    } finally {
      old.dispose();
      next?.dispose();
    }
    expect(
      next!.score.notes.every((note) => !note.glyph.onClassListChange),
    ).toBe(true);
  },
);

test("page roundtrips bind only visible glyphs once and dispose stops every highlight/scroll callback", async () => {
  const { createSourceSnapshot, renderScore } = await import("./render-score");
  const source = await createSourceSnapshot(
    Core.Score.create({
      tracks: [
        {
          notes: Array.from({ length: 32 }, (_, start) => ({
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
  const scroll = vi.fn();
  const result = await renderScore(
    source,
    {
      scale: 12,
      layoutType: LayoutType.Page,
      advanced: true,
      debug: false,
      pageLayout: { width: 36, height: 40, margin: 6 },
    },
    { onHighlight: scroll },
  );
  try {
    expect(result.pages.length).toBeGreaterThan(1);
    for (const pageIndex of [0, 1, 0, 1, 0]) {
      const current = result.selectPage(pageIndex).svg;
      // Select again to catch stacked installation on the same page.
      result.selectPage(pageIndex);
      const note = result.score.notes.find((note) =>
        current.querySelector(
          `[type="note"][data-track-id="${note.trackId}"][data-note-id="${note.id}"] [type="glyph"]`,
        ),
      )!;
      expect(note).toBeDefined();
      const offscreen = result.pages.filter((page) => page !== current);
      const expected = offscreen.map((page) => page.outerHTML);
      scroll.mockClear();
      note.glyph.setClassName(["note-highlight"]);
      expect(scroll).toHaveBeenCalledOnce();
      expect(scroll.mock.calls[0][0].ownerSVGElement).toBe(current);
      expect(offscreen.map((page) => page.outerHTML)).toEqual(expected);
      note.glyph.setClassName([]);
    }
    const pages = [...result.pages];
    const before = pages.map((page) => page.outerHTML);
    result.dispose();
    result.dispose();
    scroll.mockClear();
    for (const note of result.score.notes) {
      expect(note.glyph.onClassListChange).toBeUndefined();
      note.glyph.setClassName(["note-highlight"]);
    }
    expect(scroll).not.toHaveBeenCalled();
    expect(pages.map((page) => page.outerHTML)).toEqual(before);
  } finally {
    result.dispose();
  }
});
