import { afterEach, expect, test, vi } from "vitest";
import { observeActionState } from "./score-rendering-action-state.mjs";
afterEach(() => {
  document.body.replaceChildren();
  performance.clearMarks();
  vi.unstubAllGlobals();
});
test("observes the matching DOM commit before delayed automation and ignores preexisting state", async () => {
  const inputs = [{ id: "before" }];
  vi.stubGlobal("__renderingProbe", { inputs });
  const heading = document.createElement("h1");
  heading.textContent = "楽譜";
  vi.spyOn(heading, "getClientRects").mockReturnValue([
    {},
  ] as unknown as DOMRectList);
  document.body.append(heading);
  observeActionState({
    index: 1,
    selector: "h1",
    text: "楽譜",
    value: undefined,
  });
  await new Promise((resolve) => setTimeout(resolve, 25));
  expect(performance.getEntriesByName("rendering:action-state:1")).toHaveLength(
    0,
  );
  heading.textContent = "楽譜 1";
  inputs.push({ id: "click" });
  heading.textContent = "楽譜";
  await new Promise((resolve) => setTimeout(resolve, 0));
  const marks = performance.getEntriesByName("rendering:action-state:1");
  expect(marks).toHaveLength(1);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(marks[0].startTime).toBeLessThan(performance.now() - 40);
  heading.textContent = "other";
  heading.textContent = "楽譜";
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(performance.getEntriesByName("rendering:action-state:1")).toHaveLength(
    1,
  );
});

test("redraw waits for a new ready generation and ignores the retained old SVG", async () => {
  const inputs = [{ id: "before" }];
  vi.stubGlobal("__renderingProbe", { inputs });
  const surface = document.createElement("div");
  surface.dataset.renderState = "ready";
  surface.dataset.renderGeneration = "1";
  surface.append(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
  document.body.append(surface);
  observeActionState({
    index: 2,
    selector: "[data-render-generation]",
    attributes: { "data-render-state": "ready" },
    previousGeneration: "1",
  });
  inputs.push({ id: "change" });
  surface.dataset.layout = "page";
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(performance.getEntriesByName("rendering:action-state:2")).toHaveLength(
    0,
  );
  surface.dataset.renderState = "loading";
  surface.dataset.renderGeneration = "2";
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(performance.getEntriesByName("rendering:action-state:2")).toHaveLength(
    0,
  );
  surface.dataset.renderState = "ready";
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(performance.getEntriesByName("rendering:action-state:2")).toHaveLength(
    1,
  );
});

test("keeps the condition input identity when another trusted input is probed during redraw", async () => {
  const inputs = [{ id: "before", type: "click" }];
  vi.stubGlobal("__renderingProbe", { inputs });
  const surface = document.createElement("div");
  surface.dataset.renderGeneration = "1";
  surface.dataset.renderState = "loading";
  document.body.append(surface);
  observeActionState({
    index: 3,
    selector: "[data-render-generation]",
    attributes: { "data-render-state": "ready" },
    previousGeneration: "1",
    inputType: "resize",
  });
  inputs.push({ id: "tab-before-resize", type: "keydown" });
  surface.dataset.layout = "vertical";
  await new Promise((resolve) => setTimeout(resolve, 0));
  inputs.push({ id: "resize", type: "resize" });
  surface.dataset.renderGeneration = "2";
  await new Promise((resolve) => setTimeout(resolve, 0));
  inputs.push({ id: "tab-after-resize", type: "keydown" });
  surface.dataset.renderState = "ready";
  await new Promise((resolve) => setTimeout(resolve, 0));
  const probe = globalThis as typeof globalThis & {
    __renderingProbe: { actionStates: Record<number, { inputId: string }> };
  };
  expect(probe.__renderingProbe.actionStates[3].inputId).toBe("resize");
});
