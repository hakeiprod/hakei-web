import { afterEach, expect, test, vi } from "vitest";
import sheet from "../../fixtures/import/quarter-sheet.json";
import {
  createSourceSnapshot,
  renderScore,
  tryCreateSmallSourceSnapshot,
} from "./render-score";
import * as scheduler from "./render-scheduler";
import { LayoutType } from "../sheet";
import * as Core from "../core";
import * as Engraving from "../engraving";
import * as highlights from "./bind-note-highlights";
import type { RenderStage } from "./render-score";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const options = {
  scale: 12,
  layoutType: LayoutType.Horizontal,
  viewportWidth: 1280,
  viewportHeight: 900,
  advanced: true,
  debug: false,
  fontFamily: "Bravura",
};

test("limits boosted continuations to bounded snapshots and keeps unbounded metadata in background", async () => {
  const bounded = await createSourceSnapshot(sheet);
  const oversized = await createSourceSnapshot({
    ...sheet,
    unknown: Array.from({ length: 33 }, () => ({})),
  });
  const priorities: string[] = [];
  vi.stubGlobal("scheduler", {
    yield: async () => {
      priorities.push("bounded-continuation");
    },
    postTask: async (callback: () => void, input: { priority: string }) => {
      priorities.push(input.priority);
      callback();
    },
  });
  let clock = 0;
  const now = vi
    .spyOn(performance, "now")
    .mockImplementation(() => (clock += 9));
  let first: Awaited<ReturnType<typeof renderScore>> | undefined;
  let second: Awaited<ReturnType<typeof renderScore>> | undefined;
  try {
    first = await renderScore(bounded, options);
    expect(priorities.length).toBeGreaterThan(0);
    expect(new Set(priorities)).toEqual(new Set(["bounded-continuation"]));
    priorities.length = 0;
    second = await renderScore(oversized, options);
    expect(priorities.length).toBeGreaterThan(0);
    expect(new Set(priorities)).toEqual(new Set(["background"]));
    expect(first.drawing).toEqual(second.drawing);
    expect(first.pages.map((svg) => svg.outerHTML)).toEqual(
      second.pages.map((svg) => svg.outerHTML),
    );
  } finally {
    first?.dispose();
    second?.dispose();
    now.mockRestore();
    vi.unstubAllGlobals();
  }
});

test("owns an immutable validated snapshot and a fresh graph for each render", async () => {
  const input = structuredClone(sheet),
    snapshot = await createSourceSnapshot(input);
  const first = await renderScore(snapshot, options),
    second = await renderScore(snapshot, options);
  expect(first.score === second.score).toBe(false);
  expect(first.drawing === second.drawing).toBe(false);
  expect(Object.isFrozen(snapshot.data.notes[0])).toBe(true);
  expect(input).toEqual(sheet);
  const page = first.selectPage(999);
  expect(page.pageIndex).toBe(first.pages.length - 1);
  first.dispose();
  second.dispose();
});

test("validates options, snapshots caller values and rejects aborted jobs", async () => {
  const snapshot = await createSourceSnapshot(sheet);
  for (const scale of [0, Number.NaN, Number.POSITIVE_INFINITY])
    await expect(
      renderScore(snapshot, { ...options, scale }),
    ).rejects.toThrow();
  await expect(createSourceSnapshot({ notes: [] })).rejects.toThrow();
  const abort = new AbortController();
  abort.abort();
  await expect(
    renderScore(snapshot, options, { signal: abort.signal }),
  ).rejects.toMatchObject({ name: "AbortError" });
  const mutable = { ...options };
  const pending = renderScore(snapshot, mutable);
  mutable.scale = 18;
  const result = await pending;
  expect(result.options.scale).toBe(12);
  result.dispose();
});

test("releases model callbacks immediately while an explicit surface owner keeps DOM for retirement", async () => {
  const snapshot = await createSourceSnapshot(sheet);
  const rendered = await renderScore(snapshot, options);
  const { svg } = rendered.selectPage(0);
  document.body.append(svg);
  const note = rendered.score.notes.find(
    (note) => note.glyph.onClassListChange,
  );
  expect(note).toBeDefined();
  rendered.dispose({ removeDOM: false });
  expect(note!.glyph.onClassListChange).toBeUndefined();
  expect(svg.isConnected).toBe(true);
  expect(() => rendered.selectPage(0)).toThrow("disposed");
  svg.remove();
});

test("captures every layout dimension and nested page/debug option before asynchronous work", async () => {
  const snapshot = await createSourceSnapshot(sheet);
  const mutable = {
    ...options,
    layoutType: LayoutType.Page,
    pageLayout: { width: 36, height: 40, margin: 6 },
    debug: { enabled: true, showBoundingBox: { slot: true } },
  };
  const expected = structuredClone(mutable);
  const pending = renderScore(snapshot, mutable);
  mutable.scale = 18;
  mutable.viewportWidth = 360;
  mutable.viewportHeight = 240;
  mutable.pageLayout.width = 60;
  mutable.debug.enabled = false;
  mutable.debug.showBoundingBox.slot = false;
  const result = await pending;
  const reference = await renderScore(snapshot, expected);
  expect(result.options).toEqual(expected);
  expect(Object.isFrozen(result.options.pageLayout)).toBe(true);
  expect(Object.isFrozen(result.options.debug)).toBe(true);
  expect(result.drawing).toEqual(reference.drawing);
  expect(result.pages.map((svg) => svg.outerHTML)).toEqual(
    reference.pages.map((svg) => svg.outerHTML),
  );
  result.dispose();
  reference.dispose();
});

test("rejects invalid layout, viewport and page inputs without publishing partial SVG", async () => {
  const snapshot = await createSourceSnapshot(sheet);
  for (const change of [
    { layoutType: 999 },
    { scale: undefined as unknown as number },
    { svgPaddingBottom: -1 },
    { svgPaddingBottom: Number.NaN },
    { viewportWidth: 0 },
    { viewportHeight: Number.POSITIVE_INFINITY },
    { pageLayout: { width: 12, height: 12, margin: 6 } },
  ])
    await expect(
      renderScore(snapshot, { ...options, ...change }),
    ).rejects.toThrow(RangeError);
  const result = await renderScore(snapshot, options);
  for (const page of [Number.NaN, Number.POSITIVE_INFINITY, 0.5])
    expect(() => result.selectPage(page)).toThrow(RangeError);
  expect(result.selectPage(-1).pageIndex).toBe(0);
  result.dispose();
});

test("shares the cooperative slice budget across build, layout, pages and bindings", async () => {
  const snapshot = await createSourceSnapshot(sheet);
  let clock = 0,
    lastYield = 0;
  const gaps: number[] = [],
    stages: string[] = [];
  const drain = scheduler.drainCooperatively;
  const injected = vi
    .spyOn(scheduler, "drainCooperatively")
    .mockImplementation((steps, context) =>
      drain(steps, {
        ...context,
        budgetMs: 8,
        now: () => ++clock,
        yieldTask: async () => {
          gaps.push(clock - lastYield);
          lastYield = clock;
        },
      }),
    );
  try {
    const rendered = await renderScore(snapshot, options, {
      onStage: (stage) => stages.push(stage),
    });
    gaps.push(clock - lastYield);
    expect(stages).toEqual([
      "build",
      "layout",
      "document",
      "svg",
      "highlights",
    ]);
    expect(gaps.length).toBeGreaterThan(1);
    // One tick reads the clock again after each actual task yield.
    expect(Math.max(...gaps)).toBeLessThanOrEqual(9);
    rendered.dispose();
  } finally {
    injected.mockRestore();
  }
});

test("bounded synchronous snapshots match asynchronous validation and never capture larger graphs", async () => {
  const input = structuredClone(sheet);
  const direct = tryCreateSmallSourceSnapshot(input)!;
  const deferred = await createSourceSnapshot(input);
  expect(direct.data).toEqual(deferred.data);
  expect(Object.isFrozen(direct.data.notes[0])).toBe(true);
  expect(direct.data.notes).not.toBe(input.notes);
  const pitch = direct.data.notes[0].pitch;
  input.notes[0].pitch = 72;
  expect(direct.data.notes[0].pitch).toBe(pitch);
  expect(
    tryCreateSmallSourceSnapshot({
      ...sheet,
      unknown: Array.from({ length: 33 }, () => ({})),
    }),
  ).toBeUndefined();
  expect(() => tryCreateSmallSourceSnapshot({ notes: [] })).toThrow();
});

const renderStages = [
  "build",
  "layout",
  "document",
  "svg",
  "highlights",
] as const;

// Observe real private graphs and bindings; do not replace their cleanup.
function observeOwnedResources() {
  const scores: Engraving.Score[] = [];
  const bindings: highlights.HighlightBinding[] = [];
  const importSteps = Engraving.Score.importSteps;
  const importsClosed = vi.fn();
  vi.spyOn(Engraving.Score, "importSteps").mockImplementation(function* (
    ...arguments_
  ) {
    try {
      const score = yield* importSteps(...arguments_);
      scores.push(score);
      return score;
    } finally {
      importsClosed();
    }
  });
  const prepare = highlights.prepareNoteHighlightsSteps;
  vi.spyOn(highlights, "prepareNoteHighlightsSteps").mockImplementation(
    function* (...arguments_) {
      const binding = yield* prepare(...arguments_);
      vi.spyOn(binding, "dispose");
      vi.spyOn(binding, "activate");
      bindings.push(binding);
      return binding;
    },
  );
  const create = vi.spyOn(document, "createElementNS");
  return { scores, bindings, importsClosed, create };
}

function expectUnpublishedResourcesReleased(
  owned: ReturnType<typeof observeOwnedResources>,
) {
  for (const score of owned.scores) {
    expect(score.layoutPass).toBeNull();
    for (const note of score.notes)
      expect(note.glyph?.onClassListChange).toBeUndefined();
  }
  for (const binding of owned.bindings) {
    expect(binding.dispose).toHaveBeenCalledOnce();
    expect(binding.activate).not.toHaveBeenCalled();
  }
  for (const result of owned.create.mock.results)
    if (result.type === "return") expect(result.value.isConnected).toBe(false);
}

async function multipageSnapshot() {
  return createSourceSnapshot(
    Core.Score.create({
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
      .export(),
  );
}

const pagedOptions = {
  ...options,
  layoutType: LayoutType.Page,
  pageLayout: { width: 36, height: 40, margin: 6 },
};

test("cancel-before-start never constructs a private score, SVG or binding", async () => {
  const snapshot = await createSourceSnapshot(sheet);
  const owned = observeOwnedResources();
  const stages = vi.fn();
  const controller = new AbortController();
  controller.abort();
  await expect(
    renderScore(snapshot, options, {
      signal: controller.signal,
      onStage: stages,
    }),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(stages).not.toHaveBeenCalled();
  expect(owned.importsClosed).not.toHaveBeenCalled();
  expect(owned.create).not.toHaveBeenCalled();
  expect(owned.bindings).toHaveLength(0);
});

test.each(renderStages)(
  "abort during %s closes private work, releases ownership and permits a fresh retry",
  async (target) => {
    const snapshot = await multipageSnapshot();
    const owned = observeOwnedResources();
    const controller = new AbortController();
    const add = vi.spyOn(controller.signal, "addEventListener");
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    const stages: RenderStage[] = [];
    let clock = 0;
    const now = vi
      .spyOn(performance, "now")
      .mockImplementation(() => (clock += 9));
    let resumed = 0;
    vi.stubGlobal("scheduler", {
      yield: async () => {
        resumed++;
        if (
          stages.at(-1) === target &&
          (target !== "highlights" || owned.bindings.length > 0)
        )
          controller.abort();
      },
    });
    await expect(
      renderScore(snapshot, pagedOptions, {
        signal: controller.signal,
        onStage: (stage) => stages.push(stage),
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(stages.at(-1)).toBe(target);
    expect(owned.importsClosed).toHaveBeenCalledOnce();
    if (target === "highlights")
      expect(owned.bindings.length).toBeGreaterThan(0);
    expectUnpublishedResourcesReleased(owned);
    const yieldsAtAbort = resumed;
    await Promise.resolve();
    expect(resumed).toBe(yieldsAtAbort);
    const added = add.mock.calls.filter(([type]) => type === "abort");
    expect(added.length).toBeGreaterThan(0);
    for (const [, listener] of added)
      expect(remove).toHaveBeenCalledWith("abort", listener);
    now.mockRestore();
    vi.unstubAllGlobals();
    const retried = await renderScore(snapshot, pagedOptions);
    try {
      expect(retried.pages.length).toBeGreaterThan(1);
      expect(retried.score.notes).toHaveLength(32);
      expect(owned.scores.slice(0, -1)).not.toContain(retried.score);
      const { svg } = retried.selectPage(0);
      expect(svg.querySelectorAll("[data-note-id]").length).toBeGreaterThan(0);
    } finally {
      retried.dispose();
    }
  },
);

test.each(renderStages)(
  "exception during %s releases unpublished resources and retry preserves the drawing",
  async (target) => {
    const snapshot = await multipageSnapshot();
    const reference = await renderScore(snapshot, pagedOptions);
    const expectedDrawing = reference.drawing;
    const expectedSVG = reference.pages.map((svg) => svg.outerHTML);
    reference.dispose();
    const owned = observeOwnedResources();
    const controller = new AbortController();
    const add = vi.spyOn(controller.signal, "addEventListener");
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    const failure = new Error(`injected ${target} continuation failure`);
    let stage: RenderStage | undefined;
    let clock = 0;
    const now = vi
      .spyOn(performance, "now")
      .mockImplementation(() => (clock += 9));
    vi.stubGlobal("scheduler", {
      yield: async () => {
        if (
          stage === target &&
          (target !== "highlights" || owned.bindings.length > 0)
        )
          throw failure;
      },
    });
    await expect(
      renderScore(snapshot, pagedOptions, {
        signal: controller.signal,
        onStage: (value) => {
          stage = value;
        },
      }),
    ).rejects.toBe(failure);
    expect(stage).toBe(target);
    expect(owned.importsClosed).toHaveBeenCalledOnce();
    if (target === "highlights")
      expect(owned.bindings.length).toBeGreaterThan(0);
    expectUnpublishedResourcesReleased(owned);
    for (const [type, listener] of add.mock.calls)
      if (type === "abort")
        expect(remove).toHaveBeenCalledWith("abort", listener);
    now.mockRestore();
    vi.unstubAllGlobals();
    const retried = await renderScore(snapshot, pagedOptions);
    try {
      expect(retried.drawing).toEqual(expectedDrawing);
      expect(retried.pages.map((svg) => svg.outerHTML)).toEqual(expectedSVG);
    } finally {
      retried.dispose();
    }
  },
);

test.each(renderStages)(
  "synchronous %s failure propagates without publishing a partial graph",
  async (target) => {
    const snapshot = await createSourceSnapshot(sheet);
    const owned = observeOwnedResources();
    const failure = new Error(`injected ${target} step failure`);
    const stages: RenderStage[] = [];
    await expect(
      renderScore(snapshot, options, {
        onStage: (stage) => {
          stages.push(stage);
          if (stage === target) throw failure;
        },
      }),
    ).rejects.toBe(failure);
    expect(stages.at(-1)).toBe(target);
    expectUnpublishedResourcesReleased(owned);
    const retried = await renderScore(snapshot, options);
    expect(retried.score.notes).toHaveLength(sheet.notes.length);
    retried.dispose();
  },
);

test("abort after the final binding but before publication disposes every completed binding", async () => {
  const snapshot = await multipageSnapshot();
  const owned = observeOwnedResources();
  const controller = new AbortController();
  const drain = scheduler.drainCooperatively;
  vi.spyOn(scheduler, "drainCooperatively").mockImplementationOnce(
    async (steps, context) => {
      const result = await drain(steps, context);
      controller.abort();
      return result;
    },
  );
  await expect(
    renderScore(snapshot, pagedOptions, { signal: controller.signal }),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(owned.bindings.length).toBeGreaterThan(1);
  expectUnpublishedResourcesReleased(owned);
});

test("abort during the timer fallback clears the timer and signal listener without resuming work", async () => {
  const snapshot = await createSourceSnapshot(sheet);
  const owned = observeOwnedResources();
  const controller = new AbortController();
  const add = vi.spyOn(controller.signal, "addEventListener");
  const remove = vi.spyOn(controller.signal, "removeEventListener");
  // eslint-disable-next-line unicorn/no-useless-undefined
  vi.stubGlobal("scheduler", undefined);
  let clock = 0;
  vi.spyOn(performance, "now").mockImplementation(() => (clock += 9));
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    const stages = vi.fn();
    const pending = renderScore(snapshot, options, {
      signal: controller.signal,
      onStage: stages,
    });
    const rejection = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(vi.getTimerCount()).toBe(1);
    controller.abort();
    await rejection;
    expect(vi.getTimerCount()).toBe(0);
    const stageCount = stages.mock.calls.length;
    await vi.runAllTimersAsync();
    expect(stages).toHaveBeenCalledTimes(stageCount);
    expect(owned.importsClosed).toHaveBeenCalledOnce();
    expectUnpublishedResourcesReleased(owned);
    expect(add).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith("abort", add.mock.calls[0][1]);
  } finally {
    vi.useRealTimers();
  }
});
