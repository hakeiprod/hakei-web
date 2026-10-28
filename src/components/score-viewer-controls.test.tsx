import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { afterEach, expect, test, vi } from "vitest";
import sheet from "@/s-core/fixtures/import/quarter-sheet.json";
import { createSourceSnapshot } from "@/s-core/models/browser/render-score";
import { layoutTypeAtom } from "@/store/layout-type";
import { scaleAtom } from "@/store/scale";
import { LayoutType } from "@/s-core/models/sheet";
import { ScoreViewer } from "./score-viewer";
vi.mock("next/font/local", () => ({
  default: () => ({ className: "bravura", style: { fontFamily: "Bravura" } }),
}));
afterEach(cleanup);
test("offers all three layouts directly and keeps the persisted layout selection and SVG in sync", async () => {
  const source = await createSourceSnapshot(sheet),
    store = createStore();
  store.set(layoutTypeAtom, LayoutType.Horizontal);
  store.set(scaleAtom, 12);
  render(
    <Provider store={store}>
      <ScoreViewer source={source} />
    </Provider>,
  );
  expect(screen.getAllByRole("radio")).toHaveLength(3);
  expect(screen.getByRole("radiogroup").getAttribute("aria-label")).toBe(
    "layouttype-input",
  );
  const page = screen.getByRole("radio", { name: "ページ" });
  fireEvent.click(page);
  await waitFor(() =>
    expect(
      document.querySelector(
        '[data-layout="page"][data-render-state="ready"] svg',
      ),
    ).not.toBeNull(),
  );
  expect(store.get(layoutTypeAtom)).toBe(LayoutType.Page);
  expect((page as HTMLInputElement).checked).toBe(true);
  expect(screen.queryByRole("listbox")).toBeNull();
});

test("hydrates pre-rendered controls before applying stored client layout and scale", async () => {
  const adapter = await import("@/s-core/models/browser/render-score");
  const source = await createSourceSnapshot(sheet);
  const jobs = vi.spyOn(adapter, "renderScore");
  const nativeRect = HTMLElement.prototype.getBoundingClientRect;
  const rect = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute("aria-owns")
        ? new DOMRect(0, 100, 500, 0)
        : nativeRect.call(this);
    });
  const height = vi
    .spyOn(HTMLElement.prototype, "offsetHeight", "get")
    .mockImplementation(function (this: HTMLElement) {
      return this.tagName === "NAV" ? 93 : 0;
    });
  const { renderToString } = await import("react-dom/server");
  const { hydrateRoot } = await import("react-dom/client");
  const serverStore = createStore(),
    clientStore = createStore();
  clientStore.set(layoutTypeAtom, LayoutType.Page);
  clientStore.set(scaleAtom, 18);
  const container = document.createElement("div");
  container.innerHTML = renderToString(
    <Provider store={serverStore}>
      <ScoreViewer source={source} />
    </Provider>,
  );
  document.body.append(container);
  const recoverable = vi.fn(),
    errors = vi.spyOn(console, "error").mockImplementation(() => {});
  let root!: ReturnType<typeof hydrateRoot>;
  try {
    await act(async () => {
      root = hydrateRoot(
        container,
        <Provider store={clientStore}>
          <ScoreViewer source={source} />
        </Provider>,
        { onRecoverableError: recoverable },
      );
    });
    await waitFor(() =>
      expect(
        (
          container.querySelector(
            'input[type="radio"][value="2"]',
          ) as HTMLInputElement
        ).checked,
      ).toBe(true),
    );
    expect(
      (
        container.querySelector(
          'input[aria-label="scale-input"]',
        ) as HTMLInputElement
      ).value,
    ).toBe("18");
    await waitFor(() =>
      expect(
        document.querySelector(
          '[data-layout="page"][data-render-state="ready"] svg',
        ),
      ).not.toBeNull(),
    );
    expect(jobs).toHaveBeenCalled();
    expect(
      jobs.mock.calls.every(
        ([, options]) =>
          options.layoutType === LayoutType.Page &&
          options.scale === 18 &&
          options.viewportHeight === window.innerHeight - 100 - 93 - 16,
      ),
    ).toBe(true);
    expect(recoverable).not.toHaveBeenCalled();
    expect(errors.mock.calls.flat().map(String).join(" ")).not.toMatch(
      /hydration|hydrated|did not match/i,
    );
  } finally {
    await act(async () => root?.unmount());
    errors.mockRestore();
    jobs.mockRestore();
    rect.mockRestore();
    height.mockRestore();
    container.remove();
  }
});

test("scale uses native numeric input, accepts positive values and keeps invalid values out of rendering", async () => {
  const adapter = await import("@/s-core/models/browser/render-score");
  const source = await createSourceSnapshot(sheet);
  const store = createStore();
  store.set(layoutTypeAtom, LayoutType.Horizontal);
  store.set(scaleAtom, 12);
  const draw = vi.spyOn(adapter, "renderScore");
  const view = render(
    <Provider store={store}>
      <ScoreViewer source={source} />
    </Provider>,
  );
  try {
    await waitFor(() =>
      expect(
        document.querySelector('[data-render-state="ready"] svg'),
      ).not.toBeNull(),
    );
    const input = screen.getByLabelText("scale-input") as HTMLInputElement;
    expect(input.type).toBe("number");
    expect(input.min).toBe("1");
    fireEvent.change(input, { target: { value: "18" } });
    await waitFor(() => expect(store.get(scaleAtom)).toBe(18));
    await waitFor(() =>
      expect(
        document
          .querySelector('[data-render-state="ready"] svg')
          ?.getAttribute("width"),
      ).toBe("297"),
    );
    const calls = draw.mock.calls.length;
    fireEvent.change(input, { target: { value: "0" } });
    expect(store.get(scaleAtom)).toBe(18);
    expect(draw).toHaveBeenCalledTimes(calls);
    fireEvent.change(input, { target: { value: "1.5" } });
    await waitFor(() => expect(store.get(scaleAtom)).toBe(1.5));
    expect(input.validity.stepMismatch).toBe(false);
  } finally {
    view.unmount();
    draw.mockRestore();
  }
});
