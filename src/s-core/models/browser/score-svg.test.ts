/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import * as Core from "../core";
import "../core/extensions/to-sheet";
import { LayoutType } from "../sheet";
import * as SMUFL from "../smufl";
import "../document/extensions/to-svg";
import { bindNoteHighlights } from "./bind-note-highlights";

const fixtures = import.meta.glob("../../fixtures/core/*.json", {
  eager: true,
  import: "default",
}) as Record<string, Parameters<typeof Core.Score.create>[0]>;
function prepare(data: Parameters<typeof Core.Score.create>[0]) {
  const score: SMUFL.Score = SMUFL.Score.import(
    Core.Score.create(structuredClone(data)).toSheet().export(),
  );
  const controller = new SMUFL.Controller(score, {
    scale: 12,
    layoutType: LayoutType.Horizontal,
    debug: false,
    advanced: true,
  });
  controller.mount();
  return { score, controller };
}

function renderSVG(controller: SMUFL.Controller) {
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

describe("SMUFL through Document to SVG", () => {
  test("exposes SVG rendering on Document while SMUFL produces only Document", () => {
    expect("toSVG" in SMUFL.Score.prototype).toBe(false);
    expect("render" in SMUFL.Controller.prototype).toBe(false);
    expect(typeof SMUFL.Score.prototype.toDocument).toBe("function");
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
