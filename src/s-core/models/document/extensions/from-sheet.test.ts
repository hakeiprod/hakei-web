// @vitest-environment node
/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import * as Core from "../../core";
import "../../core/extensions/to-sheet";
import { LayoutType } from "../../sheet";
import { Document, Glyph, Group, toDocument, type Element } from "..";

const fixtures = import.meta.glob("../../../fixtures/core/*.json", {
  eager: true,
  import: "default",
}) as Record<string, Parameters<typeof Core.Score.create>[0]>;
function flatten(elements: readonly Element[]): Element[] {
  return elements.flatMap((element) => [
    element,
    ...(element instanceof Group ? flatten(element.children) : []),
  ]);
}

describe("document engraving from sheet", () => {
  test.each(Object.entries(fixtures))(
    "engraves %s without preparing or mutating the sheet",
    (_path, data) => {
      const sheet = Core.Score.create(structuredClone(data)).toSheet();
      const before = sheet.export();
      const rows = sheet.rows;
      const document = toDocument(sheet);
      expect(document).toBeInstanceOf(Document);
      const all = document.pages.flatMap((page) => flatten(page.elements));
      expect(all.filter((element) => element.role === "note")).toHaveLength(
        sheet.notes.length,
      );
      for (const element of all)
        if (element instanceof Glyph) {
          expect(Object.values(element.position).every(Number.isFinite)).toBe(
            true,
          );
          expect(Object.values(element.bounds).every(Number.isFinite)).toBe(
            true,
          );
        }
      expect(sheet.export()).toEqual(before);
      expect(sheet.rows).toBe(rows);
      expect(sheet.notes.every((note) => !("glyph" in note))).toBe(true);
      expect(sheet.staves.every((stave) => !("word" in stave))).toBe(true);
      expect(toDocument(sheet)).toEqual(document);
    },
  );
  test("paginates an unprepared sheet and preserves every note", () => {
    const sheet = Core.Score.create({
      tracks: [
        {
          notes: Array.from({ length: 64 }, (_, start) => ({
            pitch: 60,
            start,
            duration: 1,
          })),
        },
      ],
    }).toSheet();
    const document = toDocument(sheet, {
      layoutType: LayoutType.Page,
      pageLayout: { width: 36, height: 40, margin: 6 },
    });
    expect(document.pages.length).toBeGreaterThan(1);
    expect(
      document.pages
        .flatMap((page) => flatten(page.elements))
        .filter((element) => element.role === "note"),
    ).toHaveLength(64);
  });
});
