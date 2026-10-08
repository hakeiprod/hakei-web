/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import * as Core from "../../core";
import "../../core/extensions/to-sheet";
import { LayoutType } from "../../sheet";
import * as SMUFL from "..";
import "./to-svg";

const fixtures = import.meta.glob("../../../fixtures/core/*.json", {
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

function glyph(svg: SVGSVGElement, trackId: number) {
  return svg.querySelector(
    `[type="note"][data-track-id="${trackId}"][data-note-id="0"] [type="glyph"]`,
  )!;
}

describe("SMUFL through Document to SVG", () => {
  test.each(Object.entries(fixtures))(
    "renders fixture %s through the controller",
    (_name, fixture) => {
      const { score, controller } = prepare(fixture);
      const svg = controller.render();
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
    const first = controller.render();
    const note = score.notes.find((note) => !note.rest)!;
    note.glyph.setClassName(["note-highlight"]);
    expect(glyph(first, 0).getAttribute("class")).toBe("note-highlight");
    expect(glyph(first, 1).getAttribute("class")).not.toBe("note-highlight");
    const second = controller.render();
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
      controller.render().querySelectorAll("[data-debug-bounds]"),
    ).toHaveLength(0);
    controller.options.debug = true;
    expect(
      controller.render().querySelectorAll("[data-debug-bounds]").length,
    ).toBeGreaterThan(0);
    controller.unmount();
  });
});
