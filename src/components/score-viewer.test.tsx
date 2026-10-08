import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import type { ChangeEvent, ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import * as Core from "@/s-core/models/core";
import { Document } from "@/s-core/models/document";
import { LayoutType } from "@/s-core/models/sheet";
import * as SMUFL from "@/s-core/models/smufl";
import { layoutTypeAtom } from "@/store/layout-type";
import { scaleAtom } from "@/store/scale";
import { ScoreViewer } from "./score-viewer";
import { ScoreFixtureGallery } from "./score-fixture-gallery";

vi.mock("next/font/local", () => ({
  default: () => ({ className: "bravura", style: { fontFamily: "Bravura" } }),
}));

vi.mock("@heroui/react", () => ({
  NumberInput: (properties: {
    value: number;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
    "aria-label": string;
  }) => <input type="number" {...properties} />,
  Select: (properties: {
    selectedKeys: string;
    onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
    children: ReactNode;
    "aria-label": string;
  }) => (
    <select
      value={properties.selectedKeys}
      onChange={properties.onChange}
      aria-label={properties["aria-label"]}
    >
      {properties.children}
    </select>
  ),
  SelectItem: ({
    children,
  }: {
    children: "Horizontal" | "Vertical" | "Page";
  }) => (
    <option value={{ Horizontal: 0, Vertical: 1, Page: 2 }[children]}>
      {children}
    </option>
  ),
  Switch: (properties: {
    isSelected: boolean;
    onValueChange: (value: boolean) => void;
    children: string;
    "aria-label"?: string;
  }) => (
    <input
      type="checkbox"
      aria-label={properties["aria-label"] ?? properties.children}
      checked={properties.isSelected}
      onChange={(event) => properties.onValueChange(event.target.checked)}
    />
  ),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function prepare(layoutType = LayoutType.Horizontal) {
  const score = SMUFL.Score.import(
    Core.Score.create({
      tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }],
    })
      .toSheet()
      .export(),
  );
  const store = createStore();
  store.set(layoutTypeAtom, layoutType);
  store.set(scaleAtom, 12);
  const documentSVG = vi.spyOn(Document.prototype, "toSVG");
  const view = render(
    <Provider store={store}>
      <ScoreViewer score={score} />
    </Provider>,
  );
  return { ...view, score, store, documentSVG };
}

describe("ScoreViewer Document rendering used by ShowScore", () => {
  test("renders Document directly with the score font and connects playback highlights", () => {
    const { container, score, documentSVG } = prepare();
    const svg = container.querySelector("svg")!;
    expect(documentSVG).toHaveBeenCalledWith({
      scale: 12,
      fontFamily: "Bravura",
      paddingBottom: 100,
    });
    expect(svg.getAttribute("font-family")).toBe("Bravura");
    expect(svg.outerHTML).not.toMatch(/NaN|Infinity/);
    score.notes[0].glyph.setClassName(["note-highlight"]);
    expect(
      svg.querySelector('[type="note"] [type="glyph"]')?.classList,
    ).toContain("note-highlight");
  });

  test("replaces the SVG through Document when scale, layout, advanced or debug changes", () => {
    const { container, getByLabelText, score, documentSVG } = prepare();
    const original = container.querySelector("svg")!;
    fireEvent.change(getByLabelText("scale-input"), {
      target: { value: "24" },
    });
    const scaled = container.querySelector("svg")!;
    expect(scaled).not.toBe(original);
    expect(Number(scaled.getAttribute("width"))).toBe(
      Number(original.getAttribute("width")) * 2,
    );
    fireEvent.change(getByLabelText("layouttype-input"), {
      target: { value: String(LayoutType.Vertical) },
    });
    const vertical = container.querySelector("svg")!;
    expect(vertical).not.toBe(scaled);
    fireEvent.click(getByLabelText("advanced"));
    const latest = container.querySelector("svg")!;
    expect(latest).not.toBe(vertical);
    expect(container.querySelectorAll("svg")).toHaveLength(1);
    expect(
      latest.querySelectorAll("[data-debug-bounds]").length,
    ).toBeGreaterThan(0);
    const debugToggle = getByLabelText("debug") as HTMLInputElement;
    expect(debugToggle.checked).toBe(true);
    score.notes[0].glyph.setClassName(["note-highlight"]);
    fireEvent.click(debugToggle);
    const withoutDebug = container.querySelector("svg")!;
    expect(withoutDebug).not.toBe(latest);
    expect(withoutDebug.querySelectorAll("[data-debug-bounds]")).toHaveLength(
      0,
    );
    expect(debugToggle.checked).toBe(false);
    expect(
      withoutDebug.querySelector('[type="note"] [type="glyph"]')?.classList,
    ).toContain("note-highlight");
    fireEvent.change(getByLabelText("scale-input"), {
      target: { value: "30" },
    });
    expect(container.querySelectorAll("[data-debug-bounds]")).toHaveLength(0);
    fireEvent.click(debugToggle);
    const withDebug = container.querySelector("svg")!;
    expect(
      withDebug.querySelectorAll("[data-debug-bounds]").length,
    ).toBeGreaterThan(0);
    expect(debugToggle.checked).toBe(true);
    expect(container.querySelectorAll("svg")).toHaveLength(1);
    expect(documentSVG).toHaveBeenCalledTimes(7);
    expect(
      withDebug.querySelector('[type="note"] [type="glyph"]')?.classList,
    ).toContain("note-highlight");
  });

  test("rebuilds the Document and replaces the SVG on vertical resize", () => {
    vi.useFakeTimers();
    const { container, documentSVG } = prepare(LayoutType.Vertical);
    const original = container.querySelector("svg");
    fireEvent(globalThis.window, new Event("resize"));
    act(() => vi.advanceTimersByTime(150));
    expect(documentSVG).toHaveBeenCalledTimes(2);
    expect(container.querySelector("svg")).not.toBe(original);
    expect(container.querySelectorAll("svg")).toHaveLength(1);
  });
});

test("renders fixture gallery scores through Document after removing SMUFL SVG rendering", () => {
  const documentSVG = vi.spyOn(Document.prototype, "toSVG");
  const { container, getByText } = render(
    <ScoreFixtureGallery
      fixtures={[
        {
          name: "eighth note",
          data: {
            tracks: [{ notes: [{ pitch: 60, start: 0, duration: 0.5 }] }],
          },
        },
      ]}
    />,
  );
  expect(getByText("Rendered")).toBeDefined();
  expect(container.querySelectorAll("svg")).toHaveLength(1);
  expect(container.querySelector('[type="flag"]')).not.toBeNull();
  expect(documentSVG).toHaveBeenCalledWith({
    scale: 12,
    fontFamily: "Bravura",
    paddingBottom: 100,
  });
});
