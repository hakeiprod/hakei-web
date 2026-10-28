import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { Keyboard } from "@/s-core/models/browser/keyboard";
const state = vi.hoisted(() => ({
  features: { move: true, globalMove: true, click: true },
  start: vi.fn(),
  stop: vi.fn(),
  destroy: vi.fn(),
  render: vi.fn(),
  addChild: vi.fn(),
  keysDispose: vi.fn(),
  midiDispose: vi.fn(),
  observe: vi.fn(),
  disconnect: vi.fn(),
  init: vi.fn(async () => {}),
}));
vi.mock("pixi.js", () => ({
  Application: class {
    canvas = document.createElement("canvas");
    renderer = { events: { features: state.features } };
    stage = { addChild: state.addChild, removeChild: vi.fn() };
    init = state.init;
    start = state.start;
    stop = state.stop;
    destroy = state.destroy;
    render = state.render;
  },
}));
vi.mock("@/s-core/models/browser/keyboard", () => ({
  Keyboard: { WHITE_KEY_WIDTH: 20, WHITE_KEY_HEIGHT: 100 },
}));
vi.mock("@/s-core/models/keyboard_input/keyevent-connecter", () => ({
  KeyeventConnecter: class {
    dispose = state.keysDispose;
  },
}));
vi.mock("@/s-core/models/keyboard_input/midiinput-connecter", () => ({
  MidiinputConnecter: class {
    dispose = state.midiDispose;
  },
}));
import { VirtualKeyboard } from "./virtual-keyboard";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
test("keeps offscreen keyboard layout and graphics without creating WebGL, then renders on visibility", async () => {
  let notify!: IntersectionObserverCallback;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        notify = callback;
      }
      observe = state.observe;
      disconnect = state.disconnect;
    },
  );
  const graphics = { highlight: "idle" };
  const keyboard = {
    groupedRnageKeys: { white: [60] },
    container: { removeChildren: () => [] },
    render: vi.fn(() => graphics),
  };
  const view = render(
    <VirtualKeyboard keyboard={keyboard as unknown as Keyboard} />,
  );
  await waitFor(() => expect(state.observe).toHaveBeenCalledOnce());
  const canvas = view.container.querySelector("canvas")!;
  expect(canvas).not.toBeNull();
  expect(canvas.width).toBe(20);
  expect(canvas.height).toBe(100);
  expect(state.observe).toHaveBeenCalledWith(canvas);
  act(() =>
    notify(
      [{ isIntersecting: false }] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    ),
  );
  await waitFor(() => expect(keyboard.render).toHaveBeenCalledOnce());
  expect(state.init).not.toHaveBeenCalled();
  expect(state.render).not.toHaveBeenCalled();
  graphics.highlight = "pressed";
  act(() =>
    notify(
      [{ isIntersecting: true }] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    ),
  );
  await waitFor(() => expect(state.render).toHaveBeenCalledOnce());
  expect(state.init).toHaveBeenCalledWith(
    expect.objectContaining({ canvas, autoStart: false }),
  );
  expect(keyboard.render).toHaveBeenCalledOnce();
  expect(state.addChild).toHaveBeenCalledWith(graphics);
  expect(graphics.highlight).toBe("pressed");
  expect(state.start).toHaveBeenCalledOnce();
  act(() =>
    notify(
      [{ isIntersecting: false }] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    ),
  );
  expect(state.stop).toHaveBeenCalledOnce();
  expect(state.features.move).toBe(false);
  expect(state.features.globalMove).toBe(false);
  expect(state.features.click).toBe(true);
  act(() =>
    notify(
      [{ isIntersecting: true }] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    ),
  );
  expect(state.start).toHaveBeenCalledTimes(2);
  expect(state.features.move).toBe(true);
  expect(state.features.globalMove).toBe(true);
  view.unmount();
  expect(state.disconnect).toHaveBeenCalledOnce();
  expect(state.destroy).toHaveBeenCalledWith(true);
});

test("leaving an offscreen keyboard releases observers without creating a renderer", async () => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = state.observe;
      disconnect = state.disconnect;
    },
  );
  const keyboard = {
    groupedRnageKeys: { white: [60] },
    container: { removeChildren: () => [] },
    render: vi.fn(() => ({})),
  };
  const view = render(
    <VirtualKeyboard keyboard={keyboard as unknown as Keyboard} />,
  );
  await waitFor(() => expect(keyboard.render).toHaveBeenCalledOnce());
  view.unmount();
  await act(async () => {});
  expect(state.init).not.toHaveBeenCalled();
  expect(state.destroy).not.toHaveBeenCalled();
  expect(state.keysDispose).toHaveBeenCalledOnce();
  expect(state.midiDispose).toHaveBeenCalledOnce();
  expect(state.disconnect).toHaveBeenCalledOnce();
});

test("leaving before the score can paint cancels deferred WebGL initialization", async () => {
  const request = vi.fn(() => 41),
    cancel = vi.fn();
  vi.stubGlobal("requestAnimationFrame", request);
  vi.stubGlobal("cancelAnimationFrame", cancel);
  const keyboard = {
    groupedRnageKeys: { white: [60] },
    container: { removeChildren: () => [] },
    render: vi.fn(),
  };
  const view = render(
    <VirtualKeyboard keyboard={keyboard as unknown as Keyboard} />,
  );
  expect(state.init).not.toHaveBeenCalled();
  view.unmount();
  await act(async () => {});
  expect(cancel).toHaveBeenCalledWith(41);
  expect(state.init).not.toHaveBeenCalled();
});

test("waits past the first paint opportunity before initializing WebGL", async () => {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => frames.push(callback)),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const keyboard = {
    groupedRnageKeys: { white: [60] },
    container: { removeChildren: () => [] },
    render: vi.fn(() => ({})),
  };
  const view = render(
    <VirtualKeyboard keyboard={keyboard as unknown as Keyboard} />,
  );
  await act(async () => frames.shift()!(0));
  expect(state.init).not.toHaveBeenCalled();
  await act(async () => frames.shift()!(16));
  expect(state.init).toHaveBeenCalledOnce();
  view.unmount();
  expect(state.destroy).toHaveBeenCalledWith(true);
});

test("leaving while WebGL initializes destroys the late renderer without publishing it", async () => {
  let notify!: IntersectionObserverCallback;
  let finish!: () => void;
  state.init.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        notify = callback;
      }
      observe = state.observe;
      disconnect = state.disconnect;
    },
  );
  const keyboard = {
    groupedRnageKeys: { white: [60] },
    container: { removeChildren: () => [] },
    render: vi.fn(() => ({})),
  };
  const view = render(
    <VirtualKeyboard keyboard={keyboard as unknown as Keyboard} />,
  );
  act(() =>
    notify(
      [{ isIntersecting: true }] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    ),
  );
  await waitFor(() => expect(state.init).toHaveBeenCalledOnce());
  view.unmount();
  expect(state.keysDispose).toHaveBeenCalledOnce();
  expect(state.midiDispose).toHaveBeenCalledOnce();
  await act(async () => finish());
  expect(state.render).not.toHaveBeenCalled();
  expect(state.start).not.toHaveBeenCalled();
  expect(state.destroy).toHaveBeenCalledOnce();
});
