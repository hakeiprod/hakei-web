import { expect, test } from "vitest";
import { Curve } from "./curve";
import { Document, Page } from ".";
import "./extensions/to-svg";
test("draws a closed finite tie band with both endpoint identities", () => {
  const curve = new Curve({ x: 1, y: 2 }, { x: 6, y: 2 }, 1, {
    relationId: "0:0-0:1",
    part: "complete",
    startNote: { trackId: 0, noteId: 0 },
    endNote: { trackId: 0, noteId: 1 },
  });
  expect(curve.bounds.width).toBe(5);
  expect(Object.values(curve.bounds).every(Number.isFinite)).toBe(true);
  const path = new Document([new Page(10, 10, [curve])])
    .toSVG()
    .querySelector<SVGElement>('path[type="tie"]')!;
  expect(path.getAttribute("d")).toMatch(/Z$/);
  expect(path.dataset.endNoteId).toBe("1");
});
