import { afterEach, expect, test, vi } from "vitest";
import { createScoreSurface } from "./score-surface";
import { beginScoreNavigation } from "./score-navigation";
afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
test("restores the same SVG and accessibility after navigation fails or is cancelled", async () => {
  const placeholder = document.createElement("div");
  document.body.append(placeholder);
  const surface = createScoreSurface(placeholder);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.innerHTML = "<g><text>retained music</text></g>";
  surface.element.append(svg);
  surface.commit();
  surface.setVisible(true);
  const drawing = svg.outerHTML;
  for (const outcome of ["failure", "cancelled"]) {
    const finish = beginScoreNavigation();
    expect(surface.element.style.contentVisibility, outcome).toBe("hidden");
    expect(surface.element.style.clipPath).toBe("inset(100%)");
    expect(surface.element.getAttribute("aria-hidden")).toBe("true");
    expect(surface.element.firstElementChild).toBe(svg);
    finish();
    await Promise.resolve();
    expect(surface.element.style.contentVisibility).toBe("");
    expect(surface.element.style.clipPath).toBe("inset(0)");
    expect(surface.element.hasAttribute("aria-hidden")).toBe(false);
    expect(svg.outerHTML).toBe(drawing);
  }
  const finish = beginScoreNavigation();
  surface.setVisible(false);
  finish();
  await Promise.resolve();
  expect(surface.element.getAttribute("aria-hidden")).toBe("true");
  expect(surface.element.style.clipPath).toBe("inset(100%)");
  surface.retire();
  const later = beginScoreNavigation();
  later();
  expect(surface.element.style.contentVisibility).toBe("hidden");
  await surface.finished;
});

test("measures a drawing completed while navigation is pending without publishing it early", async () => {
  const placeholder = document.createElement("div");
  document.body.append(placeholder);
  const surface = createScoreSurface(placeholder);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  surface.element.append(svg);
  vi.spyOn(surface.element, "getBoundingClientRect").mockImplementation(
    () =>
      new DOMRect(
        0,
        0,
        300,
        surface.element.style.contentVisibility === "hidden" ? 0 : 120,
      ),
  );
  const finish = beginScoreNavigation();
  surface.commit();
  surface.setVisible(true);
  expect(surface.element.style.height).toBe("120px");
  expect(placeholder.style.height).toBe("120px");
  expect(surface.element.style.contentVisibility).toBe("hidden");
  expect(surface.element.getAttribute("aria-hidden")).toBe("true");
  finish();
  await Promise.resolve();
  expect(surface.element.style.height).toBe("120px");
  expect(surface.element.style.clipPath).toBe("inset(0)");
  expect(surface.element.firstElementChild).toBe(svg);
  surface.retire();
  await surface.finished;
});
test("restores native scroll offsets and ignores an obsolete queued resume", async () => {
  const placeholder = document.createElement("div");
  document.body.append(placeholder);
  const surface = createScoreSurface(placeholder);
  surface.element.append(
    document.createElementNS("http://www.w3.org/2000/svg", "svg"),
  );
  surface.commit();
  surface.setVisible(true);
  let left = 640,
    top = 120;
  Object.defineProperties(surface.element, {
    scrollLeft: {
      get: () =>
        surface.element.style.contentVisibility === "hidden" ? 0 : left,
      set: (value: number) => {
        left = value;
      },
    },
    scrollTop: {
      get: () =>
        surface.element.style.contentVisibility === "hidden" ? 0 : top,
      set: (value: number) => {
        top = value;
      },
    },
  });
  const first = beginScoreNavigation();
  expect(surface.element.scrollLeft).toBe(0);
  first();
  const second = beginScoreNavigation();
  await Promise.resolve();
  expect(surface.element.style.contentVisibility).toBe("hidden");
  second();
  await Promise.resolve();
  expect(surface.element.scrollLeft).toBe(640);
  expect(surface.element.scrollTop).toBe(120);
  const third = beginScoreNavigation();
  surface.element.scrollLeft = 0;
  surface.element.scrollTop = 0;
  surface.commit();
  third();
  await Promise.resolve();
  expect(surface.element.scrollLeft).toBe(0);
  expect(surface.element.scrollTop).toBe(0);
  surface.retire();
  await surface.finished;
});

test("does not restore a surface retired in the successful navigation commit", async () => {
  const placeholder = document.createElement("div");
  document.body.append(placeholder);
  const surface = createScoreSurface(placeholder);
  surface.element.append(
    document.createElementNS("http://www.w3.org/2000/svg", "svg"),
  );
  surface.commit();
  surface.setVisible(true);
  const finish = beginScoreNavigation();
  const measure = vi.spyOn(surface.element, "getBoundingClientRect");
  finish();
  expect(surface.element.style.contentVisibility).toBe("hidden");
  surface.retire();
  await Promise.resolve();
  expect(measure).not.toHaveBeenCalled();
  expect(surface.element.style.contentVisibility).toBe("hidden");
  await surface.finished;
});
test("hides and retires score graphics without changing inherited inert on the large SVG subtree", async () => {
  const placeholder = document.createElement("div");
  document.body.append(placeholder);
  const surface = createScoreSurface(placeholder);
  const inheritedState = vi.fn();
  Object.defineProperty(surface.element, "inert", { set: inheritedState });
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.innerHTML = "<g><text>music</text></g>".repeat(600);
  surface.element.append(svg);
  surface.commit();
  const drawing = svg.outerHTML;
  surface.setVisible(false);
  expect(surface.element.style.clipPath).toBe("inset(100%)");
  expect(surface.element.getAttribute("aria-hidden")).toBe("true");
  surface.setVisible(true);
  expect(svg.outerHTML).toBe(drawing);
  surface.retire();
  expect(surface.element.style.clipPath).toBe("inset(100%)");
  expect(surface.element.style.contentVisibility).toBe("hidden");
  expect(inheritedState).not.toHaveBeenCalled();
  expect(surface.element.style.willChange).toBe("");
  expect(surface.element.style.opacity).toBe("");
  await surface.finished;
});

test("retains inexpensive compositing for small graphics and bounds classification of large graphics", async () => {
  const placeholder = document.createElement("div");
  document.body.append(placeholder);
  const surface = createScoreSurface(placeholder);
  expect(surface.element.style.willChange).toBe("opacity");
  surface.prime();
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.innerHTML = "<g><text>small</text></g>";
  surface.element.append(svg);
  surface.commit();
  surface.setVisible(true);
  expect(surface.element.style.willChange).toBe("opacity");
  expect(surface.element.style.opacity).toBe("1");
  svg.innerHTML = "<g></g>".repeat(2000);
  const original = document.createTreeWalker.bind(document);
  const next = vi.fn();
  const create = vi
    .spyOn(document, "createTreeWalker")
    .mockImplementation((...arguments_) => {
      const walker = original(...arguments_);
      const advance = walker.nextNode.bind(walker);
      walker.nextNode = () => {
        next();
        return advance();
      };
      return walker;
    });
  surface.commit();
  expect(next.mock.calls.length).toBeLessThanOrEqual(513);
  expect(surface.element.style.willChange).toBe("");
  expect(surface.element.style.opacity).toBe("");
  create.mockRestore();
  surface.setVisible(false);
  expect(surface.element.style.clipPath).toBe("inset(100%)");
  expect(svg.children).toHaveLength(2000);
  // This case tests classification; idle retirement has separate coverage.
  svg.replaceChildren();
  surface.retire();
  await surface.finished;
});
test("uses one HTML scroll target for large graphics, shrinks with replacements and leaves the SVG unchanged", async () => {
  const placeholder = document.createElement("div");
  document.body.append(placeholder);
  const surface = createScoreSurface(placeholder);
  let width = 2000,
    height = 1000;
  const hitTarget = () =>
    surface.element.querySelector<HTMLElement>("[data-score-hit-target]");
  Object.defineProperties(surface.element, {
    scrollWidth: {
      get: () =>
        Math.max(width, Number.parseFloat(hitTarget()?.style.width || "0")),
    },
    scrollHeight: {
      get: () =>
        Math.max(height, Number.parseFloat(hitTarget()?.style.height || "0")),
    },
  });
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.innerHTML = "<g></g>".repeat(600);
  surface.element.append(svg);
  const drawing = svg.outerHTML;
  surface.commit();
  expect(hitTarget()?.getAttribute("aria-hidden")).toBe("true");
  expect(hitTarget()?.style.position).toBe("absolute");
  expect(hitTarget()?.style.width).toBe("2000px");
  expect(hitTarget()?.style.height).toBe("1000px");
  expect(svg.outerHTML).toBe(drawing);
  width = 1000;
  height = 500;
  surface.commit();
  expect(hitTarget()?.style.width).toBe("1000px");
  expect(hitTarget()?.style.height).toBe("500px");
  expect(svg.outerHTML).toBe(drawing);
  svg.replaceChildren();
  surface.commit();
  expect(hitTarget()).toBeNull();
  surface.retire();
  await surface.finished;
});
test("keeps SVG content outside the route subtree and retires it without a synchronous subtree removal", async () => {
  const placeholder = document.createElement("div");
  const route = document.createElement("main");
  route.append(placeholder);
  document.body.append(route);
  vi.spyOn(placeholder, "getBoundingClientRect").mockReturnValue({
    left: 20,
    top: 200,
    width: 800,
    height: 0,
  } as DOMRect);
  const surface = createScoreSurface(placeholder);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.innerHTML = '<g data-note-id="1"><text>music</text></g>';
  const before = svg.outerHTML;
  surface.element.append(svg);
  surface.sync();
  expect(route.contains(svg)).toBe(false);
  expect(svg.isConnected).toBe(true);
  expect(svg.outerHTML).toBe(before);
  expect(surface.element.style.left).toBe("20px");
  const remove = vi.spyOn(svg, "remove");
  surface.retire();
  surface.retire();
  route.remove();
  expect(remove).not.toHaveBeenCalled();
  expect(svg.isConnected).toBe(true);
  expect(surface.element.getAttribute("aria-hidden")).toBe("true");
  await surface.finished;
  expect(svg.isConnected).toBe(false);
  expect(surface.element.isConnected).toBe(false);
});

test("waits for idle work and leaves another viewer's SVG untouched", async () => {
  const callbacks: (() => void)[] = [];
  vi.stubGlobal("requestIdleCallback", (callback: () => void) => {
    callbacks.push(callback);
    return callbacks.length;
  });
  const placeholders = [
    document.createElement("div"),
    document.createElement("div"),
  ];
  document.body.append(...placeholders);
  const first = createScoreSurface(placeholders[0]),
    second = createScoreSurface(placeholders[1]);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.innerHTML = '<g data-note-id="different"><text>other</text></g>';
  second.element.append(svg);
  const original = svg.outerHTML;
  first.retire();
  expect(first.element.isConnected).toBe(true);
  expect(callbacks).toHaveLength(1);
  callbacks.shift()!();
  await first.finished;
  expect(first.element.isConnected).toBe(false);
  expect(svg.isConnected).toBe(true);
  expect(svg.outerHTML).toBe(original);
  second.retire();
  callbacks.shift()!();
  await second.finished;
  expect(document.querySelector('[id^="score-surface-"]')).toBeNull();
});

test("can retain committed geometry until an explicit replacement commit", async () => {
  const placeholder = document.createElement("div");
  document.body.append(placeholder);
  let width = 800;
  vi.spyOn(placeholder, "getBoundingClientRect").mockImplementation(
    () => ({ left: 0, top: 0, width, height: 100 }) as DOMRect,
  );
  const surface = createScoreSurface(placeholder, { deferResize: true });
  surface.element.append(
    document.createElementNS("http://www.w3.org/2000/svg", "svg"),
  );
  surface.commit();
  expect(surface.element.style.width).toBe("800px");
  width = 320;
  surface.sync();
  expect(surface.element.style.width).toBe("800px");
  vi.spyOn(surface.element, "getBoundingClientRect").mockReturnValue({
    height: 200,
  } as DOMRect);
  surface.commit();
  expect(surface.element.style.contain).toBe("strict");
  expect(surface.element.style.height).toBe("200px");
  expect(surface.element.style.width).toBe("320px");
  surface.retire();
  await surface.finished;
});

test("waiting preserves the complete SVG while excluding it from interaction, and retirement cannot be reversed", async () => {
  const placeholder = document.createElement("div");
  document.body.append(placeholder);
  const surface = createScoreSurface(placeholder);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.innerHTML = '<g data-note-id="1"><text>music</text></g>';
  surface.element.append(svg);
  const complete = svg.outerHTML;
  surface.setVisible(false);
  expect(svg.isConnected).toBe(true);
  expect(svg.outerHTML).toBe(complete);
  expect(surface.element.hasAttribute("inert")).toBe(false);
  expect(surface.element.getAttribute("aria-hidden")).toBe("true");
  expect(surface.element.style.clipPath).toBe("inset(100%)");
  surface.setVisible(true);
  expect(surface.element.hasAttribute("inert")).toBe(false);
  expect(surface.element.style.clipPath).toBe("inset(0)");
  surface.retire();
  surface.setVisible(true);
  expect(surface.element.getAttribute("aria-hidden")).toBe("true");
  await surface.finished;
});

test("deferred surfaces avoid forcing layout while the initial SVG is still being built", async () => {
  const placeholder = document.createElement("div");
  document.body.append(placeholder);
  const measure = vi.spyOn(placeholder, "getBoundingClientRect");
  const surface = createScoreSurface(placeholder, { deferResize: true });
  surface.sync();
  expect(measure).not.toHaveBeenCalled();
  surface.element.append(
    document.createElementNS("http://www.w3.org/2000/svg", "svg"),
  );
  surface.commit();
  expect(measure).toHaveBeenCalled();
  surface.retire();
  await surface.finished;
});

test("priming cannot reveal a retained SVG or revive a retired surface", async () => {
  const placeholder = document.createElement("div");
  document.body.append(placeholder);
  const surface = createScoreSurface(placeholder);
  surface.setVisible(false);
  surface.prime();
  expect(surface.element.style.clipPath).toBe("inset(0)");
  expect(surface.element.hasAttribute("inert")).toBe(false);
  expect(surface.element.getAttribute("aria-hidden")).toBe("true");
  surface.element.append(
    document.createElementNS("http://www.w3.org/2000/svg", "svg"),
  );
  surface.setVisible(false);
  surface.prime();
  expect(surface.element.style.clipPath).toBe("inset(100%)");
  surface.retire();
  surface.prime();
  expect(surface.element.style.clipPath).toBe("inset(100%)");
  await surface.finished;
});
