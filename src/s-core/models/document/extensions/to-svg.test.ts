import { describe, expect, test } from "vitest";
import * as Drawing from "..";
import { toSVG } from "./to-svg";

const namespace = "http://www.w3.org/2000/svg";
function sample() {
  return new Drawing.Document([
    new Drawing.Page(20, 10, [
      new Drawing.Group(
        [
          new Drawing.Glyph(
            0xe0_a4,
            { x: 2, y: 3 },
            { x: 2, y: 2, width: 1, height: 1 },
            1,
            {
              source: { trackId: 0, noteId: 0 },
              glyphName: "noteheadBlack",
              classList: ["selected"],
            },
          ),
          new Drawing.Line({ x: 1, y: 2 }, { x: 10, y: 2 }, 0.1, {
            role: "staff-line",
          }),
          new Drawing.Rectangle(
            { x: 0, y: 0, width: 4, height: 3 },
            "blue",
            0.1,
            { role: "debug-bounds", label: "<script>unsafe</script>" },
          ),
        ],
        { role: "row", position: { x: 1, y: 4 }, source: { rowId: 0 } },
      ),
    ]),
  ]);
}

describe("Document to SVG", () => {
  test("renders glyphs, lines, rectangles and nested translations as SVG", () => {
    const svg = sample().toSVG({ scale: 2, fontFamily: "Bravura" });
    expect(svg.namespaceURI).toBe(namespace);
    expect(svg.getAttribute("viewBox")).toBe("0 0 20 10");
    expect(svg.getAttribute("width")).toBe("40");
    expect(svg.getAttribute("height")).toBe("20");
    expect(svg.getAttribute("font-size")).toBe("4");
    expect(svg.getAttribute("font-family")).toBe("Bravura");
    expect(svg.querySelector('[type="row"]')!.getAttribute("transform")).toBe(
      "translate(1, 4)",
    );
    const glyph = svg.querySelector<SVGGElement>('[type="glyph"]')!;
    expect(glyph.getAttribute("class")).toBe("selected");
    expect(glyph.dataset.noteId).toBe("0");
    expect(glyph.dataset.trackId).toBe("0");
    expect(glyph.dataset.glyphName).toBe("noteheadBlack");
    const text = glyph.querySelector("text")!;
    expect(text.textContent).toBe(String.fromCodePoint(0xe0_a4));
    expect(text.getAttribute("x")).toBe("2");
    expect(text.getAttribute("y")).toBe("3");
    const line = svg.querySelector("line")!;
    expect(line.getAttribute("x2")).toBe("10");
    expect(line.getAttribute("stroke-width")).toBe("0.1");
    for (const node of svg.querySelectorAll("*"))
      expect(node.namespaceURI).toBe(namespace);
  });

  test("debug labels use text and bounds respond to pointer hover", () => {
    const svg = sample().toSVG();
    const rectangle = svg.querySelector("rect")!;
    expect(rectangle.querySelector("title")!.textContent).toBe(
      "<script>unsafe</script>",
    );
    expect(svg.querySelector("script")).toBeNull();
    rectangle.dispatchEvent(new MouseEvent("mouseenter"));
    expect(rectangle.getAttribute("fill-opacity")).toBe("0.25");
    rectangle.dispatchEvent(new MouseEvent("mouseleave"));
    expect(rectangle.getAttribute("fill-opacity")).toBe("0");
  });

  test("each call creates a new SVG without changing Document data", () => {
    const drawing = sample();
    const snapshot = JSON.stringify(drawing);
    const first = toSVG(drawing);
    first.querySelector("text")!.textContent = "changed";
    const second = drawing.toSVG();
    expect(second).not.toBe(first);
    expect(second.querySelector("text")!.textContent).toBe(
      String.fromCodePoint(0xe0_a4),
    );
    expect(JSON.stringify(drawing)).toBe(snapshot);
  });

  test("selects a page and honors font size and viewport padding", () => {
    const drawing = new Drawing.Document(
      [new Drawing.Page(10, 20), new Drawing.Page(30, 40)],
      6,
    );
    const svg = drawing.toSVG({ pageIndex: 1, scale: 2, paddingBottom: 10 });
    expect(svg.getAttribute("viewBox")).toBe("0 0 30 40");
    expect(svg.getAttribute("height")).toBe("90");
    expect(svg.getAttribute("font-size")).toBe("6");
    expect(svg.dataset.pageIndex).toBe("1");
    expect(svg.hasAttribute("font-family")).toBe(false);
  });

  test("handles an empty page", () => {
    const svg = new Drawing.Document([new Drawing.Page(0, 0)]).toSVG();
    expect(svg.getAttribute("viewBox")).toBe("0 0 0 0");
    expect(svg.querySelectorAll("text, line, rect")).toHaveLength(0);
  });

  test.each([-1, 1, 0.5])("rejects nonexistent page %s", (pageIndex) => {
    expect(() => sample().toSVG({ pageIndex })).toThrow(RangeError);
  });
  test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid scale %s",
    (scale) => {
      expect(() => sample().toSVG({ scale })).toThrow(RangeError);
    },
  );
});

test.each([
  [
    { x: 2, y: 3 },
    { x: 8, y: 3 },
  ],
  [
    { x: 2, y: 3 },
    { x: 8, y: 5 },
  ],
  [
    { x: 2, y: 5 },
    { x: 8, y: 3 },
  ],
  [
    { x: 8, y: 3 },
    { x: 7, y: 4 },
  ],
  [
    { x: 2, y: 3 },
    { x: 3, y: 4 },
  ],
  [
    { x: 2, y: 3 },
    { x: 2, y: 3 },
  ],
])(
  "renders beam rectangles with vertical end faces for %j to %j",
  (start, end) => {
    const thickness = 0.5;
    const drawing = new Drawing.Document([
      new Drawing.Page(10, 10, [
        new Drawing.Line(start, end, thickness, {
          role: "beam",
          stroke: "red",
          source: { trackId: 1 },
          classList: ["selected"],
        }),
      ]),
    ]);
    const svg = drawing.toSVG();
    const beam = svg.querySelector<SVGRectElement>('rect[type="beam"]')!;
    expect(beam).not.toBeNull();
    expect(
      svg.querySelector('line[type="beam"], path[type="beam"]'),
    ).toBeNull();
    expect(beam.getAttribute("fill")).toBe("red");
    expect(beam.getAttribute("stroke")).toBe("none");
    expect(beam.dataset.trackId).toBe("1");
    expect(beam.getAttribute("class")).toBe("selected");
    const x = Number(beam.getAttribute("x"));
    const y = Number(beam.getAttribute("y"));
    const width = Number(beam.getAttribute("width"));
    const height = Number(beam.getAttribute("height"));
    const matrix = beam
      .getAttribute("transform")!
      .slice(7, -1)
      .split(" ")
      .map(Number);
    const [scaleX, shearY, shearX, scaleY, translateX, translateY] = matrix;
    expect(matrix.every(Number.isFinite)).toBe(true);
    const transform = (px: number, py: number) => ({
      x: scaleX * px + shearX * py + translateX,
      y: shearY * px + scaleY * py + translateY,
    });
    const left = start.x <= end.x ? start : end;
    const right = start.x <= end.x ? end : start;
    for (const py of [y, y + height]) {
      expect(transform(x, py).x).toBe(left.x);
      expect(transform(x + width, py).x).toBe(right.x);
    }
    expect(transform(x, y + height / 2).y).toBeCloseTo(left.y);
    expect(transform(x + width, y + height / 2).y).toBeCloseTo(right.y);
    expect(height).toBe(thickness);
  },
);
