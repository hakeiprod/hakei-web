import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { createStore, getDefaultStore, Provider } from "jotai";
import { useEffect, type ChangeEvent, type ReactNode } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import * as Core from "@/s-core/models/core";
import { Document } from "@/s-core/models/document";
import { LayoutType } from "@/s-core/models/sheet";
import * as Engraving from "@/s-core/models/engraving";
import { debugAtom } from "@/store/debug";
import { layoutTypeAtom } from "@/store/layout-type";
import { scaleAtom } from "@/store/scale";
import { ScoreViewer } from "./score-viewer";
import { createSourceSnapshot } from "@/s-core/models/browser/render-score";
import * as BrowserRender from "@/s-core/models/browser/render-score";
import { ScoreFixtureGallery } from "./score-fixture-gallery";
import { fixtureSchema } from "@/s-core/models/fixtures/manifest";

vi.mock("next/font/local", () => ({
  default: () => ({ className: "bravura", style: { fontFamily: "Bravura" } }),
}));

const controlWork = vi.hoisted(() => ({ renders: 0 }));

test("hydration preserves SSR controls and starts with stored options after commit", async () => {
  const source = await createSourceSnapshot(
    Core.Score.create({
      tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }],
    })
      .toSheet()
      .export(),
  );
  const order: string[] = [];
  const draw = vi.spyOn(BrowserRender, "renderScore").mockImplementation(() => {
    order.push("render");
    return new Promise(() => {});
  });
  function PassiveWork() {
    useEffect(() => {
      order.push("passive");
    }, []);
    return null;
  }
  const store = createStore();
  store.set(layoutTypeAtom, LayoutType.Page);
  store.set(scaleAtom, 18);
  store.set(debugAtom, false);
  const ui = (
    <Provider store={store}>
      <PassiveWork />
      <ScoreViewer source={source} />
    </Provider>
  );
  const host = document.createElement("div");
  document.body.append(host);
  host.innerHTML = renderToString(ui);
  expect(
    host.querySelector<HTMLInputElement>('input[aria-label="scale-input"]')
      ?.value,
  ).toBe("12");
  let root: Root | undefined;
  try {
    await act(async () => {
      root = hydrateRoot(host, ui);
    });
    await waitFor(() => expect(draw).toHaveBeenCalledOnce());
    expect(order).toEqual(["passive", "render"]);
    expect(draw).toHaveBeenCalledOnce();
    expect(draw).toHaveBeenCalledWith(
      source,
      expect.objectContaining({
        scale: 18,
        layoutType: LayoutType.Page,
        debug: false,
      }),
      expect.any(Object),
    );
    expect(
      host.querySelector<HTMLInputElement>('input[aria-label="scale-input"]')
        ?.value,
    ).toBe("18");
  } finally {
    await act(async () => root?.unmount());
    host.remove();
    draw.mockRestore();
  }
});

test.each([false, true])(
  "initial viewport measurement waits for commit and respects cancellation=%s",
  async (cancelBeforeStart) => {
    const source = await createSourceSnapshot(
      Core.Score.create({
        tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }],
      })
        .toSheet()
        .export(),
    );
    const order: string[] = [];
    let release!: () => void;
    vi.stubGlobal("scheduler", {
      yield: () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    });
    const draw = vi
      .spyOn(BrowserRender, "renderScore")
      .mockImplementation(() => {
        order.push("render");
        return new Promise(() => {});
      });
    const nativeRect = HTMLElement.prototype.getBoundingClientRect;
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        if (this.hasAttribute("aria-owns")) order.push("measure");
        return nativeRect.call(this);
      });
    function PassiveWork() {
      useEffect(() => {
        order.push("passive");
      }, []);
      return null;
    }
    const store = createStore();
    store.set(debugAtom, false);
    store.set(layoutTypeAtom, LayoutType.Page);
    const view = render(
      <Provider store={store}>
        <PassiveWork />
        <ScoreViewer source={source} />
      </Provider>,
    );
    try {
      expect(order).toEqual(["passive"]);
      expect(draw).not.toHaveBeenCalled();
      if (cancelBeforeStart) view.unmount();
      await act(async () => release());
      if (cancelBeforeStart) expect(order).toEqual(["passive"]);
      else {
        expect(order[0]).toBe("passive");
        expect(order.indexOf("measure")).toBeGreaterThan(0);
        expect(order.indexOf("render")).toBeGreaterThan(
          order.indexOf("measure"),
        );
        expect(draw).toHaveBeenCalledOnce();
      }
    } finally {
      view.unmount();
      rect.mockRestore();
      draw.mockRestore();
      vi.unstubAllGlobals();
    }
  },
);

test("horizontal drawing starts without reading unneeded DOM viewport dimensions", async () => {
  const source = await createSourceSnapshot(
    Core.Score.create({
      tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }],
    })
      .toSheet()
      .export(),
  );
  const nativeRect = HTMLElement.prototype.getBoundingClientRect;
  const reads: HTMLElement[] = [];
  const rect = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: HTMLElement) {
      if (this.hasAttribute("aria-owns")) reads.push(this);
      return nativeRect.call(this);
    });
  const draw = vi
    .spyOn(BrowserRender, "renderScore")
    .mockImplementation(() => new Promise(() => {}));
  const store = createStore();
  store.set(layoutTypeAtom, LayoutType.Horizontal);
  store.set(debugAtom, false);
  const view = render(
    <Provider store={store}>
      <ScoreViewer source={source} />
    </Provider>,
  );
  try {
    expect(draw).toHaveBeenCalledOnce();
    expect(reads).toHaveLength(0);
    fireEvent(globalThis.window, new Event("resize"));
    expect(reads).toHaveLength(0);
    expect(draw).toHaveBeenCalledOnce();
  } finally {
    view.unmount();
    rect.mockRestore();
    draw.mockRestore();
  }
});

test("prepares the initial visual state before publication and retains later playback classes on redraw", async () => {
  const source = await createSourceSnapshot(
    Core.Score.create({
      tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }],
    })
      .toSheet()
      .export(),
  );
  const store = createStore();
  store.set(layoutTypeAtom, LayoutType.Horizontal);
  store.set(scaleAtom, 12);
  const initialize = vi.fn(function* (score: Engraving.Score) {
    for (const note of score.notes) {
      note.glyph.setClassName(["note-highlight"]);
      yield;
    }
  });
  let published!: Engraving.Score;
  const classes: (string | null | undefined)[] = [];
  const ready = vi.fn((score: Engraving.Score) => {
    published = score;
    classes.push(
      document
        .querySelector('[data-layout] [type="note"] [type="glyph"]')
        ?.getAttribute("class"),
    );
  });
  render(
    <Provider store={store}>
      <ScoreViewer
        source={source}
        prepareInitialScore={initialize}
        onReady={ready}
      />
    </Provider>,
  );
  await waitFor(() => expect(ready).toHaveBeenCalledOnce());
  expect(classes[0]).toContain("note-highlight");
  published.notes[0].glyph.setClassName(["retained-playback"]);
  act(() => store.set(scaleAtom, 18));
  await waitFor(() => expect(ready).toHaveBeenCalledTimes(2));
  expect(initialize).toHaveBeenCalledOnce();
  expect(classes[1]).toContain("retained-playback");
});

test("disposes an unpublished score when initial preparation fails and permits retry", async () => {
  const source = await createSourceSnapshot(
    Core.Score.create({
      tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }],
    })
      .toSheet()
      .export(),
  );
  const original = BrowserRender.renderScore;
  const results: Awaited<ReturnType<typeof original>>[] = [];
  const renderScore = vi
    .spyOn(BrowserRender, "renderScore")
    .mockImplementation(async (...arguments_) => {
      const result = await original(...arguments_);
      results.push(result);
      return result;
    });
  let attempts = 0;
  function* initialize(score: Engraving.Score) {
    if (++attempts === 1) throw new Error("initial preparation failed");
    for (const note of score.notes) {
      note.glyph.setClassName(["note-highlight"]);
      yield;
    }
  }
  const ready = vi.fn();
  try {
    const view = render(
      <ScoreViewer
        source={source}
        prepareInitialScore={initialize}
        onReady={ready}
      />,
    );
    await waitFor(() =>
      expect(view.getByRole("alert").textContent).toContain(
        "楽譜を表示できませんでした",
      ),
    );
    expect(ready).not.toHaveBeenCalled();
    expect(results[0].pages).toHaveLength(0);
    fireEvent.click(view.getByRole("button", { name: "再試行" }));
    await waitFor(() => expect(ready).toHaveBeenCalledOnce());
    expect(attempts).toBe(2);
    expect(results[1].pages).toHaveLength(1);
  } finally {
    renderScore.mockRestore();
  }
});
vi.mock("@heroui/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@heroui/react")>()),
  Input: (properties: {
    value: string;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
    "aria-label": string;
  }) => {
    controlWork.renders++;
    return (
      <input
        type="number"
        value={properties.value}
        onChange={properties.onChange}
        aria-label={properties["aria-label"]}
      />
    );
  },
  RadioGroup: (properties: {
    value: string;
    onValueChange: (value: string) => void;
    children: ReactNode;
    "aria-label": string;
  }) => (
    <select
      value={properties.value}
      onChange={(event) => properties.onValueChange(event.target.value)}
      aria-label={properties["aria-label"]}
    >
      <option value="0">横スクロール</option>
      <option value="1">縦スクロール</option>
      <option value="2">ページ</option>
    </select>
  ),
  Radio: ({
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
  getDefaultStore().set(debugAtom, true);
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function prepare(layoutType = LayoutType.Horizontal, noteCount = 1) {
  const score = Engraving.Score.import(
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
  const documentSVG = vi.spyOn(Document.prototype, "toSVGSteps");
  let latest: Engraving.Score = score;
  const view = render(
    <Provider store={store}>
      <ScoreViewer
        score={score}
        onReady={(next) => {
          latest = next;
        }}
      />
    </Provider>,
  );
  await waitReady(view.container);
  return { ...view, getScore: () => latest, store, documentSVG };
}

function scoreDOM(container: HTMLElement) {
  const id = container.querySelector("[aria-owns]")?.getAttribute("aria-owns");
  return id ? document.querySelector<HTMLElement>(`#${id}`)! : container;
}
async function waitReady(container: HTMLElement) {
  await waitFor(() =>
    expect(
      scoreDOM(container).querySelector<HTMLElement>("[data-layout]")?.dataset
        .renderState,
    ).toBe("ready"),
  );
}
async function waitResize(container: HTMLElement) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 150));
  });
  await waitReady(container);
}

function mockScoreViewport(container: HTMLElement) {
  const viewport =
    scoreDOM(container).querySelector<HTMLElement>("[data-layout]")!;
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

describe("ScoreViewer Document rendering used by ShowScore", async () => {
  test("follows playback near the horizontal edges and returns to the start without moving vertically", async () => {
    const { container, getScore } = await prepare();
    const { viewport, position } = mockScoreViewport(container);
    const glyph = getScore().notes[0].glyph;
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
    const visible = scoreDOM(container)
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

  test("follows the highlighted note after zoom and stops following after a layout change or unmount", async () => {
    const { container, getScore, getByLabelText, unmount } = await prepare();
    const { viewport, position } = mockScoreViewport(container);
    position(800);
    getScore().notes[0].glyph.setClassName(["note-highlight"]);
    viewport.scrollLeft = 0;
    fireEvent.change(getByLabelText("scale-input"), {
      target: { value: "24" },
    });
    await waitReady(container);
    expect(viewport.scrollLeft).toBeGreaterThan(0);

    fireEvent.change(getByLabelText("layouttype-input"), {
      target: { value: String(LayoutType.Vertical) },
    });
    await waitReady(container);
    viewport.scrollLeft = 0;
    getScore().notes[0].glyph.setClassName(["note-highlight"]);
    expect(viewport.scrollLeft).toBe(0);

    fireEvent.change(getByLabelText("layouttype-input"), {
      target: { value: String(LayoutType.Horizontal) },
    });
    await waitReady(container);
    expect(viewport.scrollLeft).toBeGreaterThan(0);
    viewport.scrollLeft = 0;
    unmount();
    getScore().notes[0].glyph.setClassName(["note-highlight"]);
    expect(viewport.scrollLeft).toBe(0);
  });

  test.each([LayoutType.Vertical, LayoutType.Page])(
    "does not automatically scroll playback in layout %s",
    async (layoutType) => {
      const { container, getScore } = await prepare(layoutType);
      const { viewport, position } = mockScoreViewport(container);
      position(800);
      getScore().notes[0].glyph.setClassName(["note-highlight"]);
      expect(viewport.scrollLeft).toBe(0);
    },
  );

  test("renders Document directly with the score font and connects playback highlights", async () => {
    const { container, getScore, documentSVG } = await prepare();
    const svg = scoreDOM(container).querySelector("svg")!;
    expect(documentSVG).toHaveBeenCalledWith({
      pageIndex: 0,
      scale: 12,
      fontFamily: "Bravura",
      paddingBottom: 100,
    });
    expect(svg.getAttribute("font-family")).toBe("Bravura");
    expect(svg.outerHTML).not.toMatch(/NaN|Infinity/);
    getScore().notes[0].glyph.setClassName(["note-highlight"]);
    expect(
      svg.querySelector('[type="note"] [type="glyph"]')?.classList,
    ).toContain("note-highlight");
  });

  test("replaces the SVG through Document when scale, layout, advanced or debug changes", async () => {
    const { container, getByLabelText, getScore, documentSVG } =
      await prepare();
    const original = scoreDOM(container).querySelector("svg")!;
    fireEvent.change(getByLabelText("scale-input"), {
      target: { value: "24" },
    });
    await waitReady(container);
    const scaled = scoreDOM(container).querySelector("svg")!;
    expect(scaled).not.toBe(original);
    expect(Number(scaled.getAttribute("width"))).toBe(
      Number(original.getAttribute("width")) * 2,
    );
    fireEvent.change(getByLabelText("layouttype-input"), {
      target: { value: String(LayoutType.Vertical) },
    });
    await waitReady(container);
    const vertical = scoreDOM(container).querySelector("svg")!;
    expect(vertical).not.toBe(scaled);
    fireEvent.click(getByLabelText("advanced"));
    await waitReady(container);
    const latest = scoreDOM(container).querySelector("svg")!;
    expect(latest).not.toBe(vertical);
    expect(scoreDOM(container).querySelectorAll("svg")).toHaveLength(1);
    expect(
      latest.querySelectorAll("[data-debug-bounds]").length,
    ).toBeGreaterThan(0);
    const debugToggle = getByLabelText("debug") as HTMLInputElement;
    expect(debugToggle.checked).toBe(true);
    getScore().notes[0].glyph.setClassName(["note-highlight"]);
    fireEvent.click(debugToggle);
    await waitReady(container);
    const withoutDebug = scoreDOM(container).querySelector("svg")!;
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
    await waitReady(container);
    expect(
      scoreDOM(container).querySelectorAll("[data-debug-bounds]"),
    ).toHaveLength(0);
    fireEvent.click(debugToggle);
    await waitReady(container);
    const withDebug = scoreDOM(container).querySelector("svg")!;
    expect(
      withDebug.querySelectorAll("[data-debug-bounds]").length,
    ).toBeGreaterThan(0);
    expect(debugToggle.checked).toBe(true);
    expect(scoreDOM(container).querySelectorAll("svg")).toHaveLength(1);
    expect(documentSVG).toHaveBeenCalledTimes(7);
    expect(
      withDebug.querySelector('[type="note"] [type="glyph"]')?.classList,
    ).toContain("note-highlight");
  });

  test("rebuilds the Document and replaces the SVG on vertical resize", async () => {
    vi.stubGlobal("innerWidth", 480);
    const { container, documentSVG } = await prepare(LayoutType.Vertical);
    const original = scoreDOM(container).querySelector("svg");
    vi.stubGlobal("innerWidth", 360);
    fireEvent(globalThis.window, new Event("resize"));
    await waitResize(container);
    expect(documentSVG).toHaveBeenCalledTimes(2);
    expect(scoreDOM(container).querySelector("svg")).not.toBe(original);
    expect(scoreDOM(container).querySelectorAll("svg")).toHaveLength(1);
  });

  test("offers the three drawing types and persists the selection", async () => {
    const { getByLabelText, getByText, store, container } = await prepare();
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
      expect(scoreDOM(container).querySelectorAll("svg")).toHaveLength(1);
      expect(scoreDOM(container).querySelector("svg")!.outerHTML).not.toMatch(
        /NaN|Infinity/,
      );
    }
  });

  test("navigates pages without rebuilding the score and binds highlights on each page", async () => {
    vi.stubGlobal("innerHeight", 240);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(480);
    const { container, getByText, getByLabelText, getScore, documentSVG } =
      await prepare(LayoutType.Page, 32);
    const previous = getByText("前のページ") as HTMLButtonElement;
    const next = getByText("次のページ") as HTMLButtonElement;
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);
    const original = scoreDOM(container).querySelector("svg")!;
    const firstNoteCount = original.querySelectorAll('[type="note"]').length;
    const build = vi.spyOn(Engraving.Controller.prototype, "toDocumentSteps");
    fireEvent.click(next);
    const second = scoreDOM(container).querySelector("svg")!;
    expect(second.dataset.pageIndex).toBe("1");
    expect(build).not.toHaveBeenCalled();
    expect(documentSVG).toHaveBeenCalledWith({
      pageIndex: 1,
      scale: 12,
      fontFamily: "Bravura",
      paddingBottom: 0,
    });
    await waitReady(container);
    const note = getScore().notes[firstNoteCount];
    note.glyph.setClassName(["note-highlight"]);
    expect(
      second.querySelector('[type="note"] [type="glyph"]')?.classList,
    ).toContain("note-highlight");
    fireEvent.click(previous);
    expect(scoreDOM(container).querySelector("svg")!.dataset.pageIndex).toBe(
      "0",
    );
    fireEvent.click(next);
    expect(
      scoreDOM(container).querySelector('[type="note"] [type="glyph"]')
        ?.classList,
    ).toContain("note-highlight");
    while (!next.disabled) fireEvent.click(next);
    expect(next.disabled).toBe(true);
    fireEvent.change(getByLabelText("layouttype-input"), {
      target: { value: String(LayoutType.Horizontal) },
    });
    await waitReady(container);
    expect(scoreDOM(container).querySelectorAll('[type="note"]')).toHaveLength(
      getScore().notes.length,
    );
    fireEvent.change(getByLabelText("layouttype-input"), {
      target: { value: String(LayoutType.Page) },
    });
    await waitReady(container);
    expect(scoreDOM(container).querySelector("svg")!.dataset.pageIndex).toBe(
      "0",
    );
    expect((getByText("前のページ") as HTMLButtonElement).disabled).toBe(true);
  });

  test("wraps to the container width and updates wrapping when its width changes", async () => {
    let width = 240;
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
      () => width,
    );
    const { container } = await prepare(LayoutType.Vertical, 32);
    const rowCount =
      scoreDOM(container).querySelectorAll('[type="row"]').length;
    expect(rowCount).toBeGreaterThan(1);
    expect(
      scoreDOM(container).querySelector("[data-layout]")?.getAttribute("style"),
    ).toContain("overflow-y: auto");
    width = 480;
    fireEvent(globalThis.window, new Event("resize"));
    await waitResize(container);
    expect(
      scoreDOM(container).querySelectorAll('[type="row"]').length,
    ).toBeLessThan(rowCount);
  });

  test("page size fits the visible screen and leaves room for navigation", async () => {
    vi.stubGlobal("innerHeight", 480);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(480);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 120, 480, 0),
    );
    const { container, getByText } = await prepare(LayoutType.Page, 80);
    const svg = scoreDOM(container).querySelector("svg")!;
    expect(Number(svg.getAttribute("width"))).toBe(480);
    expect(Number(svg.getAttribute("height"))).toBe(288);
    expect(svg.style.maxWidth).toBe("");
    expect(
      scoreDOM(container).querySelector<HTMLElement>('[data-layout="page"]')!
        .style.height,
    ).toBe("288px");
    expect((getByText("次のページ") as HTMLButtonElement).disabled).toBe(false);
  });

  test("screen resize recalculates pages and clamps the selected page", async () => {
    vi.stubGlobal("innerHeight", 600);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(480);
    const { container, getByText, getByLabelText } = await prepare(
      LayoutType.Page,
      80,
    );
    const next = getByText("次のページ") as HTMLButtonElement;
    const status = container.querySelector('[aria-live="polite"]')!;
    const originalPageCount = Number(status.textContent!.split("/")[1]);
    vi.stubGlobal("innerHeight", 240);
    fireEvent(globalThis.window, new Event("resize"));
    await waitResize(container);
    expect(
      Number(scoreDOM(container).querySelector("svg")!.getAttribute("height")),
    ).toBe(168);
    expect(Number(status.textContent!.split("/")[1])).toBeGreaterThan(
      originalPageCount,
    );
    while (!next.disabled) fireEvent.click(next);
    vi.stubGlobal("innerHeight", 1200);
    fireEvent(globalThis.window, new Event("resize"));
    await waitResize(container);
    const [current, total] = status.textContent!.split("/").map(Number);
    expect(current).toBe(total);
    expect(total).toBeLessThan(originalPageCount);
    expect(scoreDOM(container).querySelector("svg")!.dataset.pageIndex).toBe(
      String(total - 1),
    );
    fireEvent.change(getByLabelText("layouttype-input"), {
      target: { value: String(LayoutType.Horizontal) },
    });
    await waitReady(container);
    const horizontal = scoreDOM(container).querySelector<HTMLElement>(
      '[data-layout="horizontal"]',
    )!;
    expect(horizontal.style.maxHeight).toBe("");
    expect(horizontal.style.height).not.toBe(`${1200 - 72}px`);
  });

  test("a score that fits on screen has a single page", async () => {
    const { getByText } = await prepare(LayoutType.Page);
    expect(getByText("1 / 1")).toBeDefined();
    expect((getByText("前のページ") as HTMLButtonElement).disabled).toBe(true);
    expect((getByText("次のページ") as HTMLButtonElement).disabled).toBe(true);
  });

  test("ignores invalid scales", async () => {
    const { getByLabelText, store } = await prepare();
    for (const value of ["0", "-1", ""]) {
      fireEvent.change(getByLabelText("scale-input"), { target: { value } });
      expect(store.get(scaleAtom)).toBe(12);
    }
  });
});

test("saves debug changes and restores them when the viewer mounts in a new store", async () => {
  const first = await prepare();
  fireEvent.click(first.getByLabelText("debug"));
  expect(localStorage.getItem("debug")).toBe("false");
  first.unmount();
  const second = await prepare();
  expect((second.getByLabelText("debug") as HTMLInputElement).checked).toBe(
    false,
  );
  expect(second.container.querySelectorAll("[data-debug-bounds]")).toHaveLength(
    0,
  );
  fireEvent.click(second.getByLabelText("debug"));
  expect(localStorage.getItem("debug")).toBe("true");
});

test("fixture galleries restore and share the saved debug preference", async () => {
  localStorage.setItem("debug", "false");
  const store = createStore();
  const fixture = {
    name: "quarter note",
    data: {
      tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }],
    },
  };
  const { container, getAllByText } = render(
    <Provider store={store}>
      <ScoreFixtureGallery fixtures={[fixture]} />
      <ScoreFixtureGallery fixtures={[fixture]} />
    </Provider>,
  );
  await waitFor(() => expect(getAllByText("Rendered")).toHaveLength(2));
  expect(getAllByText("debug: OFF")).toHaveLength(2);
  expect(
    scoreDOM(container).querySelectorAll("[data-debug-bounds]"),
  ).toHaveLength(0);
  fireEvent.click(getAllByText("debug: OFF")[0]);
  await waitFor(() => expect(getAllByText("Rendered")).toHaveLength(2));
  expect(getAllByText("debug: ON")).toHaveLength(2);
  expect(localStorage.getItem("debug")).toBe("true");
  expect(
    scoreDOM(container).querySelectorAll("[data-debug-bounds]").length,
  ).toBeGreaterThan(0);
});

test("renders fixture gallery scores through Document and toggles their debug bounds", async () => {
  const documentSVG = vi.spyOn(Document.prototype, "toSVGSteps");
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
  await waitFor(() => expect(getByText("Rendered")).toBeDefined());
  expect(scoreDOM(container).querySelectorAll("svg")).toHaveLength(1);
  expect(scoreDOM(container).querySelector('[type="flag"]')).not.toBeNull();
  expect(documentSVG).toHaveBeenCalledWith({
    pageIndex: 0,
    scale: 12,
    fontFamily: "Bravura",
    paddingBottom: 100,
  });
  const toggle = getByText("debug: ON");
  expect(toggle.getAttribute("aria-pressed")).toBe("true");
  expect(
    scoreDOM(container).querySelectorAll("[data-debug-bounds]").length,
  ).toBeGreaterThan(0);
  fireEvent.click(toggle);
  await waitFor(() => expect(getByText("Rendered")).toBeDefined());
  expect(toggle.textContent).toBe("debug: OFF");
  expect(toggle.getAttribute("aria-pressed")).toBe("false");
  expect(
    scoreDOM(container).querySelectorAll("[data-debug-bounds]"),
  ).toHaveLength(0);
  expect(scoreDOM(container).querySelectorAll("svg")).toHaveLength(1);
  fireEvent.click(toggle);
  await waitFor(() => expect(getByText("Rendered")).toBeDefined());
  expect(
    scoreDOM(container).querySelectorAll("[data-debug-bounds]").length,
  ).toBeGreaterThan(0);
  expect(scoreDOM(container).querySelectorAll("svg")).toHaveLength(1);
});

test("renders serialized MusicXML sheets and isolates fixture import errors", async () => {
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
  await waitFor(() => expect(getByText("Rendered")).toBeDefined());
  expect(getByText("Invalid Musicxml")).toBeDefined();
  expect(scoreDOM(container).querySelectorAll("svg")).toHaveLength(1);
});

test("invalid persisted layouts show an error and recover through a valid selection", async () => {
  const sheet = Core.Score.create({
    tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }],
  })
    .toSheet()
    .export();
  const source = await createSourceSnapshot(sheet);
  const store = createStore();
  store.set(layoutTypeAtom, 999 as LayoutType);
  const view = render(
    <Provider store={store}>
      <ScoreViewer source={source} />
    </Provider>,
  );
  await waitFor(() =>
    expect(view.getByRole("alert").textContent).toContain("表示できません"),
  );
  expect(scoreDOM(view.container).querySelector("svg")).toBeNull();
  fireEvent.change(view.getByLabelText("layouttype-input"), {
    target: { value: String(LayoutType.Horizontal) },
  });
  await waitReady(view.container);
  expect(
    scoreDOM(view.container).querySelectorAll('[type="note"]'),
  ).toHaveLength(source.data.notes.length);
});

test("revision switches hide the old SVG immediately and remounting the same source keeps its geometry", async () => {
  const data = Core.Score.create({
    tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }],
  })
    .toSheet()
    .export();
  const first = await createSourceSnapshot(data);
  data.notes[0].pitch = 72;
  const revision = await createSourceSnapshot(data);
  const store = createStore();
  store.set(debugAtom, false);
  store.set(layoutTypeAtom, LayoutType.Horizontal);
  store.set(scaleAtom, 12);
  let latest: Engraving.Score | undefined;
  const ready = (score: Engraving.Score) => {
    latest = score;
  };
  const view = render(
    <Provider store={store}>
      <ScoreViewer source={first} onReady={ready} />
    </Provider>,
  );
  await waitReady(view.container);
  const oldSVG = scoreDOM(view.container).querySelector("svg")!;
  const oldNote = latest!.notes[0];
  view.rerender(
    <Provider store={store}>
      <ScoreViewer source={revision} onReady={ready} />
    </Provider>,
  );
  expect(oldSVG.isConnected).toBe(false);
  await waitReady(view.container);
  const current = scoreDOM(view.container).querySelector("svg")!;
  const serialized = current.outerHTML;
  expect(latest!.notes[0].pitch).not.toEqual(oldNote.pitch);
  oldNote.glyph.setClassName(["note-highlight"]);
  expect(current.outerHTML).toBe(serialized);
  view.unmount();
  const remounted = render(
    <Provider store={store}>
      <ScoreViewer source={revision} />
    </Provider>,
  );
  await waitReady(remounted.container);
  expect(scoreDOM(remounted.container).querySelector("svg")!.outerHTML).toBe(
    serialized,
  );
});

test("gallery rendering yields before model import and isolates a failing asynchronous fixture", async () => {
  const sync = vi.spyOn(Engraving.Score, "import").mockImplementation(() => {
    throw new Error("Synchronous gallery import is forbidden");
  });
  const data = Core.Score.create({
    tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }],
  })
    .toSheet()
    .export();
  const view = render(
    <ScoreFixtureGallery
      fixtures={[
        { name: "valid", sheet: data },
        {
          name: "invalid",
          sheet: { ...data, notes: [{ ...data.notes[0], pitch: -100 }] },
        },
        { name: "rejected", rejected: true },
        { name: "partial", partial: true },
      ]}
    />,
  );
  expect(view.container.querySelector("svg")).toBeNull();
  await waitFor(() => expect(view.getAllByText("Rendered")).toHaveLength(1));
  expect(sync).not.toHaveBeenCalled();
  expect(view.container.querySelectorAll("article")[1].textContent).toContain(
    "Error",
  );
  expect(view.getAllByText("描画対象外")).toHaveLength(2);
});

test("gallery publishes all pages and preserves live document/SVG checks without claiming visual approval", async () => {
  const sheet = Core.Score.create({
    tracks: [
      {
        notes: Array.from({ length: 32 }, (_, start) => ({
          pitch: 60,
          start,
          duration: 1,
        })),
      },
    ],
  })
    .toSheet()
    .export();
  const definition = fixtureSchema.parse({
    id: "page-regression",
    title: "Page regression",
    target: "Page coverage",
    requirementRefs: ["FR-004"],
    source: {
      path: "test.json",
      format: "CORE_JSON",
      provenance: "Existing core notes",
    },
    expectedOutcome: "render",
    requiredStages: ["document", "svg", "visual"],
    layout: {
      type: "Page",
      scale: 12,
      pageLayout: { width: 36, height: 40, margin: 6 },
    },
    assertions: [
      {
        id: "document-notes",
        stage: "document",
        kind: "count",
        selector: { role: "note" },
        expected: sheet.notes.length,
      },
      {
        id: "svg-notes",
        stage: "svg",
        kind: "count",
        selector: { role: "note" },
        expected: sheet.notes.length,
      },
    ],
    visualChecklist: [
      { id: "visual-notes", expected: "Review note placement" },
    ],
  });
  const view = render(
    <ScoreFixtureGallery fixtures={[{ name: "pages", sheet, definition }]} />,
  );
  await waitFor(() => expect(view.getByText("Rendered")).toBeDefined());
  const owner = scoreDOM(view.container);
  expect(owner.querySelectorAll("svg").length).toBeGreaterThan(1);
  expect(owner.querySelectorAll('[type="note"]')).toHaveLength(
    sheet.notes.length,
  );
  expect(Number(owner.querySelector("svg")!.getAttribute("height"))).toBe(580);
  expect(
    view.getByText(`document-notes: ${sheet.notes.length} · pass`),
  ).toBeDefined();
  expect(
    view.getByText(`svg-notes: ${sheet.notes.length} · pass`),
  ).toBeDefined();
  expect(view.getByText("目視: Review note placement · pending")).toBeDefined();
});

test("resize observations only rebuild when the layout's measured dimensions change", async () => {
  const callbacks: ResizeObserverCallback[] = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        callbacks.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );
  let width = 480;
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
    () => width,
  );
  const { container } = await prepare(LayoutType.Vertical, 32);
  const initial = scoreDOM(container).querySelector("svg");
  const changed = vi.spyOn(Engraving.Controller.prototype, "toDocumentSteps");
  const notify = () => {
    for (const callback of callbacks) callback([], {} as ResizeObserver);
  };
  act(notify);
  await waitResize(container);
  expect(changed).not.toHaveBeenCalled();
  width = 360;
  act(notify);
  await waitResize(container);
  expect(changed).toHaveBeenCalledOnce();
  expect(scoreDOM(container).querySelector("svg")).not.toBe(initial);
  act(notify);
  await waitResize(container);
  expect(changed).toHaveBeenCalledOnce();
});

test("retains the committed viewport height while a replacement layout is pending", async () => {
  vi.stubGlobal("innerHeight", 600);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(480);
  const { container, getByLabelText } = await prepare(LayoutType.Page, 32);
  const viewport =
    scoreDOM(container).querySelector<HTMLElement>("[data-layout]")!;
  const initialHeight = viewport.style.height;
  expect(Number.parseFloat(initialHeight)).toBeGreaterThan(0);
  const original = BrowserRender.renderScore;
  let resume!: () => void;
  const pending = new Promise<void>((resolve) => {
    resume = resolve;
  });
  vi.spyOn(BrowserRender, "renderScore").mockImplementationOnce(
    async (...parameters) => {
      await pending;
      return original(...parameters);
    },
  );
  fireEvent.change(getByLabelText("layouttype-input"), {
    target: { value: String(LayoutType.Horizontal) },
  });
  expect(viewport.dataset.renderState).toBe("loading");
  expect(viewport.style.height).toBe(initialHeight);
  expect(viewport.hasAttribute("inert")).toBe(false);
  expect(viewport.getAttribute("aria-hidden")).toBe("true");
  expect(viewport.style.clipPath).toBe("inset(100%)");
  expect(viewport.querySelector("svg")).not.toBeNull();
  await act(async () => {
    resume();
  });
  await waitReady(container);
  expect(viewport.dataset.layout).toBe("horizontal");
});

test("uses the visible content width when a native scrollbar occupies the viewport", async () => {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return Object.hasOwn(this.dataset, "layout") ? 465 : 480;
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(480);
  const render = vi.spyOn(BrowserRender, "renderScore");
  const { container } = await prepare(LayoutType.Vertical, 32);
  await waitReady(container);
  expect(render.mock.calls.at(-1)?.[1].viewportWidth).toBe(465);
});

test("condition changes keep every nonempty glyph class on the new private score", async () => {
  const { container, getScore, store } = await prepare(
    LayoutType.Horizontal,
    4,
  );
  const previous = getScore();
  previous.notes[0].glyph.setClassName(["note-highlight", "custom-state"]);
  previous.notes[2].glyph.setClassName(["another-state"]);
  act(() => store.set(scaleAtom, 18));
  await waitReady(container);
  const current = getScore();
  expect(current).not.toBe(previous);
  expect(current.notes[0].glyph.classList).toEqual([
    "note-highlight",
    "custom-state",
  ]);
  expect(current.notes[2].glyph.classList).toEqual(["another-state"]);
  expect(current.notes[1].glyph.classList).toEqual([]);
  const svg = scoreDOM(container).querySelector("svg")!;
  expect(svg.querySelectorAll(".custom-state")).toHaveLength(1);
  expect(svg.querySelectorAll(".another-state")).toHaveLength(1);
  previous.notes[0].glyph.setClassName(["old-only"]);
  expect(svg.querySelector(".old-only")).toBeNull();
});

test("does not repeat unchanged input work while accepting and publishing a snapshot", async () => {
  const { default: data } =
    await import("@/s-core/fixtures/import/quarter-sheet.json");
  const source = await createSourceSnapshot(data);
  const store = createStore();
  store.set(layoutTypeAtom, LayoutType.Horizontal);
  store.set(scaleAtom, 12);
  const view = render(
    <Provider store={store}>
      <ScoreViewer />
    </Provider>,
  );
  const initial = controlWork.renders;
  view.rerender(
    <Provider store={store}>
      <ScoreViewer source={source} />
    </Provider>,
  );
  await waitFor(() =>
    expect(
      document.querySelector(
        '[data-layout="horizontal"][data-render-state="ready"] svg',
      ),
    ).not.toBeNull(),
  );
  expect(controlWork.renders).toBe(initial);
  const before = document.querySelector(
    '[data-layout="horizontal"][data-render-state="ready"] svg',
  );
  fireEvent.change(view.getByLabelText("scale-input"), {
    target: { value: "18" },
  });
  await waitFor(() => {
    const next = document.querySelector(
      '[data-layout="horizontal"][data-render-state="ready"] svg',
    );
    expect(next).not.toBeNull();
    expect(next).not.toBe(before);
  });
  expect(controlWork.renders).toBe(initial + 1);
});

test("keeps an empty initial surface ready to paint but inaccessible while validation is pending", () => {
  const view = render(<ScoreViewer />);
  const ownerId = view.container
    .querySelector("[aria-owns]")!
    .getAttribute("aria-owns")!;
  const surface = document.querySelector(`#${ownerId}`)!
    .firstElementChild as HTMLDivElement;
  expect(surface.firstElementChild).toBeNull();
  expect(surface.style.clipPath).toBe("inset(0)");
  expect(surface.hasAttribute("inert")).toBe(false);
  expect(surface.getAttribute("aria-hidden")).toBe("true");
});

// Publication belongs to the real Viewer, rather than a test-only generation owner.
test.each([
  ["source", "success"],
  ["source", "failure"],
  ["scale", "success"],
  ["scale", "failure"],
  ["cancel-retry", "success"],
  ["cancel-retry", "failure"],
  ["unmount", "success"],
  ["unmount", "failure"],
] as const)(
  "late A %s/%s cannot publish over B or resurrect a retired Viewer",
  async (change, outcome) => {
    const sourceA = await createSourceSnapshot(
      Core.Score.create({
        tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }],
      })
        .toSheet()
        .export(),
    );
    const sourceB = await createSourceSnapshot(
      Core.Score.create({
        tracks: [{ notes: [{ pitch: 72, start: 0, duration: 1 }] }],
      })
        .toSheet()
        .export(),
    );
    const store = createStore();
    store.set(layoutTypeAtom, LayoutType.Horizontal);
    store.set(scaleAtom, 12);
    store.set(debugAtom, false);
    const original = BrowserRender.renderScore;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let stale: BrowserRender.RenderedScore | undefined;
    let staleSVG: SVGSVGElement | undefined;
    let waiting = false;
    const draw = vi
      .spyOn(BrowserRender, "renderScore")
      .mockImplementationOnce(async (...arguments_) => {
        if (outcome === "success") {
          stale = await original(...arguments_);
          staleSVG = stale.pages[0];
          vi.spyOn(stale, "dispose");
        }
        waiting = true;
        // Deliberately ignore abort at this boundary to force a late completion.
        await gate;
        if (outcome === "failure") throw new Error("late A private failure");
        return stale!;
      });
    const ready = vi.fn();
    const status = vi.fn();
    const ui = (source: BrowserRender.SourceSnapshot) => (
      <Provider store={store}>
        <ScoreViewer source={source} onReady={ready} onStatusChange={status} />
      </Provider>
    );
    const view = render(ui(sourceA));
    await waitFor(() => expect(waiting).toBe(true));
    expect(ready).not.toHaveBeenCalled();
    expect(scoreDOM(view.container).querySelector("svg")).toBeNull();
    const signalA = draw.mock.calls[0][2]?.signal;
    expect(signalA?.aborted).toBe(false);
    switch (change) {
      case "source": {
        view.rerender(ui(sourceB));
        break;
      }
      case "scale": {
        act(() => store.set(scaleAtom, 18));
        break;
      }
      case "cancel-retry": {
        fireEvent.click(view.getByRole("button", { name: "表示を取消" }));
        expect(view.getByRole("status").textContent).toContain("取り消");
        fireEvent.click(view.getByRole("button", { name: "再試行" }));

        break;
      }
      default: {
        view.unmount();
      }
    }
    expect(signalA?.aborted).toBe(true);
    let currentSVG: Element | null = null;
    let generation: string | undefined;
    let currentScore: Engraving.Score | undefined;
    if (change !== "unmount") {
      await waitFor(() => expect(ready).toHaveBeenCalledOnce());
      await waitReady(view.container);
      currentSVG = scoreDOM(view.container).querySelector("svg");
      expect(currentSVG).not.toBeNull();
      currentScore = ready.mock.calls[0][0];
      expect(currentScore!.notes[0].pitch?.value).toBe(
        change === "source" ? 72 : 60,
      );
      expect(draw).toHaveBeenCalledTimes(2);
      expect(draw.mock.calls[1][0]).toBe(
        change === "source" ? sourceB : sourceA,
      );
      expect(draw.mock.calls[1][1].scale).toBe(change === "scale" ? 18 : 12);
      expect(draw.mock.calls[1][2]?.signal).not.toBe(signalA);
      generation = scoreDOM(view.container).querySelector<HTMLElement>(
        "[data-render-generation]",
      )!.dataset.renderGeneration;
      expect(Number(generation)).toBeGreaterThan(1);
    }
    const statusCount = status.mock.calls.length;
    await act(async () => {
      release();
      await gate;
    });
    expect(status).toHaveBeenCalledTimes(statusCount);
    expect(view.queryByRole("alert")).toBeNull();
    if (change === "unmount") expect(ready).not.toHaveBeenCalled();
    else {
      expect(ready).toHaveBeenCalledOnce();
      expect(scoreDOM(view.container).querySelector("svg")).toBe(currentSVG);
      expect(
        scoreDOM(view.container).querySelector<HTMLElement>(
          "[data-render-generation]",
        )!.dataset.renderGeneration,
      ).toBe(generation);
      expect(status).toHaveBeenLastCalledWith(true);
      expect(
        currentScore!.notes.some((note) => note.glyph.onClassListChange),
      ).toBe(true);
    }
    if (stale) {
      expect(stale.dispose).toHaveBeenCalledOnce();
      expect(stale.pages).toHaveLength(0);
      expect(stale.score.layoutPass).toBeNull();
      expect(staleSVG!.isConnected).toBe(false);
      for (const note of stale.score.notes)
        expect(note.glyph.onClassListChange).toBeUndefined();
    }
    view.unmount();
    if (currentScore)
      for (const note of currentScore.notes)
        expect(note.glyph.onClassListChange).toBeUndefined();
  },
);

test.each([
  ["same", "error"],
  ["same", "cancelled"],
  ["different", "error"],
  ["different", "cancelled"],
] as const)(
  "keeps %s-source ownership safe through %s then retries current conditions",
  async (replacement, terminal) => {
    const source = await createSourceSnapshot(
      Core.Score.create({
        tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }],
      })
        .toSheet()
        .export(),
    );
    const store = createStore();
    store.set(layoutTypeAtom, LayoutType.Horizontal);
    store.set(scaleAtom, 12);
    store.set(debugAtom, false);
    const ready = vi.fn();
    const status = vi.fn();
    const view = render(
      <Provider store={store}>
        <ScoreViewer source={source} onReady={ready} onStatusChange={status} />
      </Provider>,
    );
    await waitReady(view.container);
    const oldSVG = scoreDOM(view.container).querySelector("svg")!;
    const oldScore = ready.mock.calls[0][0] as Engraving.Score;
    let fail!: (reason: Error) => void;
    const draw = vi.spyOn(BrowserRender, "renderScore").mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    );
    const nextSource =
      replacement === "same"
        ? source
        : await createSourceSnapshot(
            Core.Score.create({
              tracks: [{ notes: [{ pitch: 72, start: 0, duration: 1 }] }],
            })
              .toSheet()
              .export(),
          );
    if (replacement === "same") act(() => store.set(scaleAtom, 18));
    else
      view.rerender(
        <Provider store={store}>
          <ScoreViewer
            source={nextSource}
            onReady={ready}
            onStatusChange={status}
          />
        </Provider>,
      );
    await waitFor(() => expect(draw).toHaveBeenCalledOnce());
    expect(view.getByRole("status").textContent).toContain("準備・更新");
    expect(scoreDOM(view.container).querySelector("svg")).toBe(
      replacement === "same" ? oldSVG : null,
    );
    expect(status).toHaveBeenLastCalledWith(false);
    if (terminal === "error") {
      await act(async () => fail(new Error("private implementation details")));
      expect(view.getByRole("alert").textContent).toContain(
        "楽譜を表示できませんでした",
      );
      expect(view.queryByText(/private implementation details/)).toBeNull();
    } else {
      fireEvent.click(view.getByRole("button", { name: "表示を取消" }));
      expect(view.getByRole("status").textContent).toContain("取り消しました");
      expect(draw.mock.calls[0][2]?.signal?.aborted).toBe(true);
      await act(async () => fail(new Error("late cancelled failure")));
      expect(view.queryByRole("alert")).toBeNull();
    }
    expect(scoreDOM(view.container).querySelector("svg")).toBe(
      replacement === "same" ? oldSVG : null,
    );
    expect(ready).toHaveBeenCalledOnce();
    fireEvent.click(view.getByRole("button", { name: "再試行" }));
    await waitReady(view.container);
    expect(draw.mock.calls[1][0]).toBe(nextSource);
    expect(draw.mock.calls[1][1].scale).toBe(replacement === "same" ? 18 : 12);
    expect(ready).toHaveBeenCalledTimes(2);
    expect(status).toHaveBeenLastCalledWith(true);
    expect(scoreDOM(view.container).querySelector("svg")).not.toBe(oldSVG);
    expect(oldSVG.isConnected).toBe(false);
    expect(oldScore.notes.every((note) => !note.glyph.onClassListChange)).toBe(
      true,
    );
    expect(view.queryByRole("alert")).toBeNull();
  },
);

test("empty input keeps controls mounted until a source arrives and publishes ready", async () => {
  const store = createStore();
  store.set(layoutTypeAtom, LayoutType.Horizontal);
  store.set(scaleAtom, 12);
  const ready = vi.fn();
  const draw = vi.spyOn(BrowserRender, "renderScore");
  const ui = (source?: BrowserRender.SourceSnapshot) => (
    <Provider store={store}>
      <ScoreViewer source={source} onReady={ready} />
    </Provider>
  );
  const view = render(ui());
  const controls = view.getByLabelText("scale-input");
  expect(draw).not.toHaveBeenCalled();
  expect(
    (view.getByRole("button", { name: "表示を取消" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  const source = await createSourceSnapshot(
    Core.Score.create({
      tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }],
    })
      .toSheet()
      .export(),
  );
  view.rerender(ui(source));
  await waitReady(view.container);
  expect(view.getByLabelText("scale-input")).toBe(controls);
  expect(ready).toHaveBeenCalledOnce();
});
