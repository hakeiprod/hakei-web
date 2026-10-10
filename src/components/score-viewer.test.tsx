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
  }) => (
    <input
      type="number"
      value={properties.value}
      onChange={properties.onChange}
      aria-label={properties["aria-label"]}
    />
  ),
  Select: (properties: {
    selectedKeys: string[];
    onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
    children: ReactNode;
    "aria-label": string;
  }) => (
    <select
      value={properties.selectedKeys[0]}
      onChange={properties.onChange}
      aria-label={properties["aria-label"]}
    >
      {properties.children}
    </select>
  ),
  SelectItem: ({
    children,
  }: {
    children: "横スクロール" | "縦スクロール" | "ページ";
  }) => (
    <option value={{ 横スクロール: 0, 縦スクロール: 1, ページ: 2 }[children]}>
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
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function prepare(layoutType = LayoutType.Horizontal, noteCount = 1) {
  const score = SMUFL.Score.import(
    Core.Score.create({
      tracks: [
        {
          notes: Array.from({ length: noteCount }, (_, start) => ({
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

function mockScoreViewport(container: HTMLElement) {
  const viewport = container.querySelector<HTMLElement>("[data-layout]")!;
  vi.spyOn(viewport, "clientWidth", "get").mockReturnValue(320);
  vi.spyOn(viewport, "scrollWidth", "get").mockReturnValue(1600);
  vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(
    new DOMRect(100, 40, 320, 120),
  );
  let notePosition = 100;
  vi.spyOn(SVGElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: SVGElement) {
      // Measure the rendered note in viewport coordinates, including scrolling.
      expect(viewport.contains(this)).toBe(true);
      return new DOMRect(100 + notePosition - viewport.scrollLeft, 80, 20, 20);
    },
  );
  return { viewport, position: (value: number) => (notePosition = value) };
}

describe("ScoreViewer Document rendering used by ShowScore", () => {
  test("follows playback near the horizontal edges and returns to the start without moving vertically", () => {
    const { container, score } = prepare();
    const { viewport, position } = mockScoreViewport(container);
    const glyph = score.notes[0].glyph;
    viewport.scrollTop = 30;
    glyph.setClassName(["note-highlight"]);
    expect(viewport.scrollLeft).toBe(0);

    // Scroll before the note reaches the right edge, leaving space ahead.
    position(250);
    glyph.setClassName(["note-highlight"]);
    expect(viewport.scrollLeft).toBeGreaterThan(0);
    expect(viewport.scrollLeft).toBeLessThan(250);

    // Seeking forward brings a distant note back into the same viewport.
    position(800);
    glyph.setClassName(["note-highlight"]);
    const visible = container
      .querySelector('[type="note"] [type="glyph"]')!
      .getBoundingClientRect();
    expect(visible.left).toBeGreaterThanOrEqual(100);
    expect(visible.right).toBeLessThan(420);

    // Replay/rewind follows notes to the left as well.
    position(20);
    glyph.setClassName(["note-highlight"]);
    expect(viewport.scrollLeft).toBe(0);
    position(800);
    glyph.setClassName([]);
    expect(viewport.scrollLeft).toBe(0);
    expect(viewport.scrollTop).toBe(30);
  });

  test("follows the highlighted note after zoom and stops following after a layout change or unmount", () => {
    const { container, score, getByLabelText, unmount } = prepare();
    const { viewport, position } = mockScoreViewport(container);
    position(800);
    score.notes[0].glyph.setClassName(["note-highlight"]);
    viewport.scrollLeft = 0;
    fireEvent.change(getByLabelText("scale-input"), {
      target: { value: "24" },
    });
    expect(viewport.scrollLeft).toBeGreaterThan(0);

    fireEvent.change(getByLabelText("layouttype-input"), {
      target: { value: String(LayoutType.Vertical) },
    });
    viewport.scrollLeft = 0;
    score.notes[0].glyph.setClassName(["note-highlight"]);
    expect(viewport.scrollLeft).toBe(0);

    fireEvent.change(getByLabelText("layouttype-input"), {
      target: { value: String(LayoutType.Horizontal) },
    });
    expect(viewport.scrollLeft).toBeGreaterThan(0);
    viewport.scrollLeft = 0;
    unmount();
    score.notes[0].glyph.setClassName(["note-highlight"]);
    expect(viewport.scrollLeft).toBe(0);
  });

  test.each([LayoutType.Vertical, LayoutType.Page])(
    "does not automatically scroll playback in layout %s",
    (layoutType) => {
      const { container, score } = prepare(layoutType);
      const { viewport, position } = mockScoreViewport(container);
      position(800);
      score.notes[0].glyph.setClassName(["note-highlight"]);
      expect(viewport.scrollLeft).toBe(0);
    },
  );

  test("renders Document directly with the score font and connects playback highlights", () => {
    const { container, score, documentSVG } = prepare();
    const svg = container.querySelector("svg")!;
    expect(documentSVG).toHaveBeenCalledWith({
      pageIndex: 0,
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

  test("offers the three drawing types and persists the selection", () => {
    const { getByLabelText, getByText, store, container } = prepare();
    for (const label of ["横スクロール", "縦スクロール", "ページ"])
      expect(getByText(label)).toBeDefined();
    for (const type of [
      LayoutType.Vertical,
      LayoutType.Page,
      LayoutType.Horizontal,
    ]) {
      fireEvent.change(getByLabelText("layouttype-input"), {
        target: { value: String(type) },
      });
      expect(store.get(layoutTypeAtom)).toBe(type);
      expect(container.querySelectorAll("svg")).toHaveLength(1);
      expect(container.querySelector("svg")!.outerHTML).not.toMatch(
        /NaN|Infinity/,
      );
    }
  });

  test("navigates pages without rebuilding the score and binds highlights on each page", () => {
    vi.stubGlobal("innerHeight", 240);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(480);
    const { container, getByText, getByLabelText, score, documentSVG } =
      prepare(LayoutType.Page, 32);
    const previous = getByText("前のページ") as HTMLButtonElement;
    const next = getByText("次のページ") as HTMLButtonElement;
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);
    const original = container.querySelector("svg")!;
    const firstNoteCount = original.querySelectorAll('[type="note"]').length;
    const build = vi.spyOn(SMUFL.Controller.prototype, "toDocument");
    fireEvent.click(next);
    const second = container.querySelector("svg")!;
    expect(second.dataset.pageIndex).toBe("1");
    expect(build).not.toHaveBeenCalled();
    expect(documentSVG).toHaveBeenLastCalledWith({
      pageIndex: 1,
      scale: 12,
      fontFamily: "Bravura",
      paddingBottom: 0,
    });
    const note = score.notes[firstNoteCount];
    note.glyph.setClassName(["note-highlight"]);
    expect(
      second.querySelector('[type="note"] [type="glyph"]')?.classList,
    ).toContain("note-highlight");
    fireEvent.click(previous);
    expect(container.querySelector("svg")!.dataset.pageIndex).toBe("0");
    fireEvent.click(next);
    expect(
      container.querySelector('[type="note"] [type="glyph"]')?.classList,
    ).toContain("note-highlight");
    while (!next.disabled) fireEvent.click(next);
    expect(next.disabled).toBe(true);
    fireEvent.change(getByLabelText("layouttype-input"), {
      target: { value: String(LayoutType.Horizontal) },
    });
    expect(container.querySelectorAll('[type="note"]')).toHaveLength(
      score.notes.length,
    );
    fireEvent.change(getByLabelText("layouttype-input"), {
      target: { value: String(LayoutType.Page) },
    });
    expect(container.querySelector("svg")!.dataset.pageIndex).toBe("0");
    expect((getByText("前のページ") as HTMLButtonElement).disabled).toBe(true);
  });

  test("wraps to the container width and updates wrapping when its width changes", () => {
    vi.useFakeTimers();
    let width = 240;
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
      () => width,
    );
    const { container } = prepare(LayoutType.Vertical, 32);
    const rowCount = container.querySelectorAll('[type="row"]').length;
    expect(rowCount).toBeGreaterThan(1);
    expect(
      container.querySelector("[data-layout]")?.getAttribute("style"),
    ).toContain("overflow-y: auto");
    width = 480;
    fireEvent(globalThis.window, new Event("resize"));
    act(() => vi.advanceTimersByTime(150));
    expect(container.querySelectorAll('[type="row"]').length).toBeLessThan(
      rowCount,
    );
  });

  test("page size fits the visible screen and leaves room for navigation", () => {
    vi.stubGlobal("innerHeight", 480);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(480);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 120, 480, 0),
    );
    const { container, getByText } = prepare(LayoutType.Page, 80);
    const svg = container.querySelector("svg")!;
    expect(Number(svg.getAttribute("width"))).toBe(480);
    expect(Number(svg.getAttribute("height"))).toBe(288);
    expect(svg.style.maxWidth).toBe("");
    expect(
      container.querySelector<HTMLElement>('[data-layout="page"]')!.style
        .height,
    ).toBe("288px");
    expect((getByText("次のページ") as HTMLButtonElement).disabled).toBe(false);
  });

  test("screen resize recalculates pages and clamps the selected page", () => {
    vi.useFakeTimers();
    vi.stubGlobal("innerHeight", 600);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(480);
    const { container, getByText, getByLabelText } = prepare(
      LayoutType.Page,
      80,
    );
    const next = getByText("次のページ") as HTMLButtonElement;
    const status = container.querySelector('[aria-live="polite"]')!;
    const originalPageCount = Number(status.textContent!.split("/")[1]);
    vi.stubGlobal("innerHeight", 240);
    fireEvent(globalThis.window, new Event("resize"));
    act(() => vi.advanceTimersByTime(150));
    expect(Number(container.querySelector("svg")!.getAttribute("height"))).toBe(
      168,
    );
    expect(Number(status.textContent!.split("/")[1])).toBeGreaterThan(
      originalPageCount,
    );
    while (!next.disabled) fireEvent.click(next);
    vi.stubGlobal("innerHeight", 1200);
    fireEvent(globalThis.window, new Event("resize"));
    act(() => vi.advanceTimersByTime(150));
    const [current, total] = status.textContent!.split("/").map(Number);
    expect(current).toBe(total);
    expect(total).toBeLessThan(originalPageCount);
    expect(container.querySelector("svg")!.dataset.pageIndex).toBe(
      String(total - 1),
    );
    fireEvent.change(getByLabelText("layouttype-input"), {
      target: { value: String(LayoutType.Horizontal) },
    });
    expect(
      container.querySelector<HTMLElement>('[data-layout="horizontal"]')!.style
        .height,
    ).toBe("");
  });

  test("a score that fits on screen has a single page", () => {
    const { getByText } = prepare(LayoutType.Page);
    expect(getByText("1 / 1")).toBeDefined();
    expect((getByText("前のページ") as HTMLButtonElement).disabled).toBe(true);
    expect((getByText("次のページ") as HTMLButtonElement).disabled).toBe(true);
  });

  test("ignores invalid scales", () => {
    const { getByLabelText, store } = prepare();
    for (const value of ["0", "-1", ""]) {
      fireEvent.change(getByLabelText("scale-input"), { target: { value } });
      expect(store.get(scaleAtom)).toBe(12);
    }
  });
});

test("renders fixture gallery scores through Document and toggles their debug bounds", () => {
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
  const toggle = getByText("debug: ON");
  expect(toggle.getAttribute("aria-pressed")).toBe("true");
  expect(
    container.querySelectorAll("[data-debug-bounds]").length,
  ).toBeGreaterThan(0);
  fireEvent.click(toggle);
  expect(toggle.textContent).toBe("debug: OFF");
  expect(toggle.getAttribute("aria-pressed")).toBe("false");
  expect(container.querySelectorAll("[data-debug-bounds]")).toHaveLength(0);
  expect(container.querySelectorAll("svg")).toHaveLength(1);
  fireEvent.click(toggle);
  expect(
    container.querySelectorAll("[data-debug-bounds]").length,
  ).toBeGreaterThan(0);
  expect(container.querySelectorAll("svg")).toHaveLength(1);
});

test("renders serialized MusicXML sheets and isolates fixture import errors", () => {
  const sheet = Core.Score.create({
    tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }],
  })
    .toSheet()
    .export();
  const { container, getByText } = render(
    <ScoreFixtureGallery
      fixtures={[
        { name: "valid.mxl", sheet },
        { name: "invalid.mxl", error: "Invalid Musicxml" },
      ]}
    />,
  );
  expect(getByText("Rendered")).toBeDefined();
  expect(getByText("Invalid Musicxml")).toBeDefined();
  expect(container.querySelectorAll("svg")).toHaveLength(1);
});
