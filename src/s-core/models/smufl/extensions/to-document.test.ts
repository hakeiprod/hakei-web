// @vitest-environment node
/// <reference types="vite/client" />
import { readFile } from "node:fs/promises";
import { Importer } from "../../browser/importer";
import { describe, expect, test, vi } from "vitest";
import * as Core from "../../core";
import "../../core/extensions/to-sheet";
import * as Drawing from "../../document";
import { LayoutType } from "../../sheet";
import * as SMUFL from "..";
import { toDocument } from "./to-document";

const fixtures = import.meta.glob("../../../fixtures/core/*.json", {
  eager: true,
  import: "default",
}) as Record<string, Parameters<typeof Core.Score.create>[0]>;

function prepare(data: Parameters<typeof Core.Score.create>[0]): SMUFL.Score {
  const score = SMUFL.Score.import(
    Core.Score.create(structuredClone(data)).toSheet().export(),
  );
  if (score.tracks.length > 0) {
    const controller = new SMUFL.Controller(score, {
      scale: 12,
      layoutType: LayoutType.Horizontal,
      debug: false,
      advanced: true,
    });
    controller.mount();
    controller.order();
  }
  return score;
}

function flatten(elements: readonly Drawing.Element[]): Drawing.Element[] {
  return elements.flatMap((element) => [
    element,
    ...(element instanceof Drawing.Group ? flatten(element.children) : []),
  ]);
}

function checkGeometry(element: Drawing.Element) {
  if (element instanceof Drawing.Glyph) {
    expect(Number.isInteger(element.codepoint)).toBe(true);
    expect(Object.values(element.position).every(Number.isFinite)).toBe(true);
    expect(Object.values(element.bounds).every(Number.isFinite)).toBe(true);
  } else if (element instanceof Drawing.Group) {
    expect(Object.values(element.position).every(Number.isFinite)).toBe(true);
  } else if (element instanceof Drawing.Line) {
    expect(Object.values(element.start).every(Number.isFinite)).toBe(true);
    expect(Object.values(element.end).every(Number.isFinite)).toBe(true);
    expect(element.strokeWidth).toBeGreaterThan(0);
  } else if (element instanceof Drawing.Rectangle) {
    expect(Object.values(element.bounds).every(Number.isFinite)).toBe(true);
  }
}

describe("SMUFL to Document", () => {
  test.each(Object.entries(fixtures))(
    "converts %s without a browser and produces finite geometry",
    (_name, data) => {
      const score = prepare(data);
      expect(typeof globalThis.window).toBe("undefined");
      const document = score.toDocument({ debug: true });
      expect(document).toBeInstanceOf(Drawing.Document);
      expect(document.pages).toHaveLength(1);
      const page = document.pages[0];
      expect(page.width).toBeGreaterThanOrEqual(0);
      expect(page.height).toBeGreaterThanOrEqual(0);
      const elements = flatten(page.elements);
      for (const element of elements) checkGeometry(element);
      expect(
        elements.filter((element) => element.role === "note"),
      ).toHaveLength(score.notes.length);
    },
  );

  test("retains note identity and renders staff lines, stems and final barlines", () => {
    const score = prepare({
      tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }],
    });
    const elements = flatten(toDocument(score).pages[0].elements);
    const note = elements.find(
      (element) => element.role === "note" && element.source?.noteId === 0,
    ) as Drawing.Group;
    const glyph = note.children[0] as Drawing.Glyph;
    expect(glyph.codepoint).toBe(0xe0_a4);
    expect(glyph.position.y).toBe(5);
    expect(glyph.source).toMatchObject({
      rowId: 0,
      barId: 0,
      trackId: 0,
      staveId: 0,
      chordId: 0,
      noteId: 0,
    });
    expect(
      elements.filter((element) => element.role === "staff-line"),
    ).toHaveLength(5);
    expect(elements.some((element) => element.role === "stem")).toBe(true);
    expect(
      elements.some((element) => element.role === "barline-end-thick"),
    ).toBe(true);
  });

  test("copies glyphs and classes without modifying callbacks or the score", () => {
    const score = prepare({
      tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1.5 }] }],
    });
    const original = score.notes[0].glyph;
    original.setClassName(["selected"]);
    const callback = vi.fn();
    original.onClassListChange = callback;
    const before = JSON.stringify(score.export());
    const first = score.toDocument();
    const second = score.toDocument();
    expect(first).toEqual(second);
    expect(JSON.stringify(score.export())).toBe(before);
    expect(original.onClassListChange).toBe(callback);
    expect(callback).not.toHaveBeenCalled();
    const glyph = flatten(first.pages[0].elements).find(
      (element) =>
        element instanceof Drawing.Glyph && element.source?.noteId === 0,
    ) as Drawing.Glyph;
    expect(glyph.classList).toEqual(["selected"]);
    const snapshot = JSON.stringify(first);
    original.x = 100;
    original.classList.push("changed");
    expect(JSON.stringify(first)).toBe(snapshot);
    expect(
      flatten(first.pages[0].elements).filter(
        (element) =>
          element instanceof Drawing.Glyph &&
          element.glyphName === "augmentationDot" &&
          element.source?.noteId === 0,
      ),
    ).toHaveLength(1);
  });

  test("keeps row translations separate from glyph positions", () => {
    const score = prepare({
      tracks: [
        {
          notes: [
            { pitch: 60, start: 0, duration: 1 },
            { pitch: 64, start: 4, duration: 1 },
          ],
        },
      ],
    });
    for (const [id, bar] of score.masterbars.entries()) bar.rowId = id;
    score.rows = score.masterbars.map((bar, id) => {
      const row = new SMUFL.Row({ id });
      row.score = score;
      return row;
    });
    const document = score.toDocument();
    const rows = document.pages[0].elements as Drawing.Group[];
    expect(rows).toHaveLength(2);
    expect(rows[0].position).toEqual({ x: 0, y: 0 });
    expect(rows[1].position.y).toBeGreaterThan(0);
    expect(rows[1].source).toEqual({ rowId: 1 });
    expect((rows[1].children[0] as Drawing.Group).position.x).toBe(0);
  });

  test("converts MusicXML beams and stems to finite lines", async () => {
    const logging = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const data = await readFile(
        new URL(
          "../../../fixtures/files/musicxml/beat_8th.mxl",
          import.meta.url,
        ),
      );
      const sheet = await new Importer().import(
        new File([new Uint8Array(data)], "beat_8th.mxl"),
      );
      const score = SMUFL.Score.import(sheet.export());
      const controller = new SMUFL.Controller(score, {
        scale: 12,
        layoutType: LayoutType.Horizontal,
        debug: false,
        advanced: true,
      });
      controller.mount();
      controller.order();
      const elements = flatten(score.toDocument().pages[0].elements);
      expect(elements.some((element) => element.role === "beam")).toBe(true);
      for (const element of elements) checkGeometry(element);
    } finally {
      logging.mockRestore();
    }
  });

  test("debug bounds are optional", () => {
    const score = prepare({
      tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }],
    });
    expect(
      flatten(score.toDocument().pages[0].elements).some(
        (element) => element instanceof Drawing.Rectangle,
      ),
    ).toBe(false);
    expect(
      flatten(score.toDocument({ debug: true }).pages[0].elements).some(
        (element) => element instanceof Drawing.Rectangle,
      ),
    ).toBe(true);
  });

  test("rejects scores whose layout has not been initialized", () => {
    const score = SMUFL.Score.import(
      Core.Score.create({
        tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }],
      })
        .toSheet()
        .export(),
    );
    expect(() => score.toDocument()).toThrow("laid out score");
  });
});
