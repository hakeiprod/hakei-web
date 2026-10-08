import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import type { ChangeEvent, ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import * as Core from "@/s-core/models/core";
import { Document } from "@/s-core/models/document";
import { LayoutType } from "@/s-core/models/sheet";
import * as SMUFL from "@/s-core/models/smufl";
import "@/s-core/models/smufl/extensions/to-svg";
import { layoutTypeAtom } from "@/store/layout-type";
import { scaleAtom } from "@/store/scale";
import { ScoreViewer } from "./score-viewer";

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
  }) => (
    <input
      type="checkbox"
      aria-label="advanced"
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
  const controllerRender = vi
    .spyOn(SMUFL.Controller.prototype, "render")
    .mockImplementation(() => {
      throw new Error("ScoreViewer must render Document directly.");
    });
  const legacySVG = vi.spyOn(SMUFL.Score.prototype, "toSVG");
  const view = render(
    <Provider store={store}>
      <ScoreViewer score={score} />
    </Provider>,
  );
  return { ...view, score, store, documentSVG, controllerRender, legacySVG };
}

describe("ScoreViewer Document rendering used by ShowScore", () => {
  test("renders Document directly with the score font and connects playback highlights", () => {
    const { container, score, documentSVG, controllerRender, legacySVG } =
      prepare();
    const svg = container.querySelector("svg")!;
    expect(documentSVG).toHaveBeenCalledWith({
      scale: 12,
      fontFamily: "Bravura",
      paddingBottom: 100,
    });
    expect(svg.getAttribute("font-family")).toBe("Bravura");
    expect(svg.outerHTML).not.toMatch(/NaN|Infinity/);
    expect(controllerRender).not.toHaveBeenCalled();
    expect(legacySVG).not.toHaveBeenCalled();
    score.notes[0].glyph.setClassName(["note-highlight"]);
    expect(
      svg.querySelector('[type="note"] [type="glyph"]')?.classList,
    ).toContain("note-highlight");
  });

  test("replaces the SVG through Document when scale, layout or advanced changes", () => {
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
    expect(documentSVG).toHaveBeenCalledTimes(4);
    score.notes[0].glyph.setClassName(["note-highlight"]);
    expect(
      latest.querySelector('[type="note"] [type="glyph"]')?.classList,
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
