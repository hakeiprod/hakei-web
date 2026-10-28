import { afterEach, expect, test, vi } from "vitest";
import { drainCooperatively, yieldToPaint } from "./render-scheduler";
import { drainSteps } from "../sheet/render-steps";

afterEach(() => vi.unstubAllGlobals());

test("paint preparation rejects promptly and removes its frame and listener when cancelled between paints", async () => {
  for (const advanceFirstFrame of [false, true]) {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    let callback!: FrameRequestCallback;
    let id = 0;
    vi.stubGlobal("requestAnimationFrame", (next: FrameRequestCallback) => {
      callback = next;
      return ++id;
    });
    const cancel = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancel);
    const pending = yieldToPaint(controller.signal);
    if (advanceFirstFrame) callback(0);
    const rejected = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    controller.abort();
    await rejected;
    expect(cancel).toHaveBeenCalledWith(advanceFirstFrame ? 2 : 1);
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(() => yieldToPaint(controller.signal)).toThrow(/aborted/i);
  }
});
function* sequence(order: number[]) {
  for (let index = 0; index < 5; index++) {
    order.push(index);
    yield;
  }
  return [...order];
}

test("cooperative and synchronous drains preserve results and permit a real timer task", async () => {
  // The API requires an explicit value to simulate an absent platform scheduler.
  // eslint-disable-next-line unicorn/no-useless-undefined
  vi.stubGlobal("scheduler", undefined);
  const order: number[] = [],
    synchronous = drainSteps(sequence([]));
  let timerRan = false,
    unitsWhenTimerRan = -1;
  setTimeout(() => {
    timerRan = true;
    unitsWhenTimerRan = order.length;
  }, 0);
  const result = await drainCooperatively(sequence(order), {
    budgetMs: 1,
    now: () => order.length * 2,
  });
  expect(result).toEqual(synchronous);
  expect(timerRan).toBe(true);
  expect(unitsWhenTimerRan).toBeLessThan(5);
});

test("detects scheduler.yield and falls back when unavailable", async () => {
  const yieldTask = vi.fn(async () => {});
  vi.stubGlobal("scheduler", { yield: yieldTask });
  const order: number[] = [];
  await drainCooperatively(sequence(order), {
    budgetMs: 1,
    now: () => order.length * 2,
  });
  expect(yieldTask).toHaveBeenCalled();
});

test("lets ordinary UI work run ahead of rendering continuations on the native scheduler", async () => {
  vi.stubGlobal("scheduler", {
    // A boosted continuation can repeatedly overtake ordinary UI tasks.
    yield: async () => {},
    postTask: (callback: () => void, options: { priority: string }) =>
      options.priority === "background"
        ? new Promise<void>((resolve) =>
            setTimeout(() => {
              callback();
              resolve();
            }, 0),
          )
        : Promise.resolve().then(callback),
  });
  const order: number[] = [];
  let unitsWhenUIRan = -1;
  const ui = new Promise<void>((resolve) =>
    setTimeout(() => {
      unitsWhenUIRan = order.length;
      resolve();
    }, 0),
  );
  const result = await drainCooperatively(sequence(order), {
    budgetMs: 1,
    now: () => order.length * 2,
  });
  await ui;
  expect(result).toEqual(drainSteps(sequence([])));
  expect(unitsWhenUIRan).toBeLessThan(5);
});

test("aborts a pending background continuation without resuming the iterator", async () => {
  const controller = new AbortController();
  let options: { signal?: AbortSignal } | undefined;
  let release!: () => void;
  vi.stubGlobal("scheduler", {
    postTask: (_callback: () => void, input: { signal?: AbortSignal }) => {
      options = input;
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    },
  });
  const order: number[] = [];
  let closed = false;
  function* work() {
    try {
      yield* sequence(order);
    } finally {
      closed = true;
    }
  }
  const pending = drainCooperatively(work(), {
    signal: controller.signal,
    budgetMs: 1,
    now: () => order.length * 2,
  });
  const rejected = expect(pending).rejects.toMatchObject({
    name: "AbortError",
  });
  controller.abort();
  await rejected;
  expect(closed).toBe(true);
  expect(order).toEqual([0]);
  expect(options?.signal).toBe(controller.signal);
  release();
  await Promise.resolve();
  expect(order).toEqual([0]);
});

test("abort before start performs no work and releases the iterator", async () => {
  const controller = new AbortController();
  controller.abort();
  const next = vi.fn(),
    close = vi.fn(() => ({ done: true as const, value: undefined }));
  await expect(
    drainCooperatively({ next, return: close }, { signal: controller.signal }),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(next).not.toHaveBeenCalled();
  expect(close).toHaveBeenCalledOnce();
});

test("abort at a yield rejects immediately, closes once, and runs no later unit", async () => {
  let closed = 0;
  const order: number[] = [],
    controller = new AbortController();
  function* build() {
    try {
      yield* sequence(order);
    } finally {
      closed++;
    }
  }
  await expect(
    drainCooperatively(build(), {
      signal: controller.signal,
      budgetMs: 1,
      now: () => order.length * 2,
      yieldTask: async () => {
        controller.abort();
      },
    }),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(order).toEqual([0]);
  expect(closed).toBe(1);
});

test("checks cancellation after each unit and propagates step/yield errors with cleanup", async () => {
  for (const failure of ["abort", "step", "yield"] as const) {
    const controller = new AbortController();
    let closed = false,
      count = 0;
    function* build() {
      try {
        count++;
        if (failure === "abort") controller.abort();
        if (failure === "step") throw new Error("step");
        yield;
        count++;
      } finally {
        closed = true;
      }
    }
    await expect(
      drainCooperatively(build(), {
        signal: controller.signal,
        budgetMs: 1,
        now: () => count * 2,
        yieldTask: async () => {
          throw new Error("yield");
        },
      }),
    ).rejects.toThrow(failure === "abort" ? /abort/i : failure);
    expect(count).toBe(1);
    expect(closed).toBe(true);
  }
});

test("invalid budgets cannot silently turn the iterator into an unbounded microtask", async () => {
  await expect(
    drainCooperatively(sequence([]), { budgetMs: 0 }),
  ).rejects.toThrow(/budget/i);
});

test("cancels a pending platform yield without waiting for its promise and removes its listener", async () => {
  const controller = new AbortController();
  const remove = vi.spyOn(controller.signal, "removeEventListener");
  const order: number[] = [];
  let released = false;
  function* build() {
    try {
      yield* sequence(order);
    } finally {
      released = true;
    }
  }
  const pending = drainCooperatively(build(), {
    signal: controller.signal,
    budgetMs: 1,
    now: () => order.length * 2,
    yieldTask: () => new Promise<void>(() => {}),
  });
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(order).toEqual([0]);
  expect(released).toBe(true);
  expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
});
