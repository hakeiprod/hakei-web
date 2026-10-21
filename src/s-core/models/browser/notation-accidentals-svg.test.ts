import { expect, test } from "vitest";
import { Glyph, Document, Page } from "../document";
import "../document/extensions/to-svg";
import { svgRecords } from "./evaluate-fixture-svg";
import { evaluateAssertion } from "../fixtures/evaluate";
test("does not mistake a sharp for a required natural", () => {
  const svg = new Document([
    new Page(10, 10, [
      new Glyph(
        0xe2_62,
        { x: 2, y: 3 },
        { x: 2, y: 2, width: 1, height: 2 },
        1,
        { glyphName: "accidentalSharp", source: { trackId: 0, noteId: 0 } },
      ),
    ]),
  ]).toSVG();
  const result = evaluateAssertion(
    "natural",
    {
      id: "natural",
      stage: "svg",
      kind: "count",
      selector: {
        glyphName: "accidentalNatural",
        source: { trackId: 0, noteId: 0 },
      },
      expected: 1,
    },
    svgRecords([svg]),
  );
  expect(result.status).toBe("fail");
});

test("detects a missing character even when glyph metadata remains", () => {
  const page = new Document([
    new Page(10, 10, [
      new Glyph(
        0xe2_62,
        { x: 2, y: 3 },
        { x: 2, y: 2, width: 1, height: 2 },
        1,
        { glyphName: "accidentalSharp" },
      ),
    ]),
  ]).toSVG();
  const assertion = {
    id: "sharp",
    stage: "svg" as const,
    kind: "count" as const,
    selector: { glyphName: "accidentalSharp" },
    expected: 1,
  };
  expect(evaluateAssertion("sharp", assertion, svgRecords([page])).status).toBe(
    "pass",
  );
  page.querySelector("text")!.textContent = "";
  expect(evaluateAssertion("sharp", assertion, svgRecords([page])).status).toBe(
    "fail",
  );
});
