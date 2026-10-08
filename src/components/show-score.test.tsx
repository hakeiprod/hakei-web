import { StrictMode } from "react";
import { render, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ShowScore } from "./show-score";

const resources = vi.hoisted(() => ({
  controllers: [] as {
    mount: ReturnType<typeof vi.fn>;
    unmount: ReturnType<typeof vi.fn>;
  }[],
  highlighters: [] as {
    highlight: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }[],
}));
vi.mock("@/s-core/models/browser/audio", () => ({
  Controller: class {
    mount = vi.fn();
    unmount = vi.fn();
    constructor() {
      resources.controllers.push(this);
    }
  },
}));
vi.mock("@/s-core/models/audio_sheet/note-highlighter", () => ({
  NoteHighlighter: class {
    highlight = vi.fn();
    stop = vi.fn();
    constructor() {
      resources.highlighters.push(this);
    }
  },
}));
vi.mock("@/s-core/models/browser/keyboard", () => ({ Keyboard: class {} }));
vi.mock("@/s-core/models/sheet", () => ({
  Score: { import: () => ({ toAudio: () => ({ keyRange: [] }) }) },
}));
vi.mock("@/s-core/models/sheet/extensions/to-audio", () => ({}));
vi.mock("@/s-core/models/smufl", () => ({ Score: { import: () => ({}) } }));
vi.mock("@/s-core/models/files/soundfont2", () => ({
  default: { create: () => ({}) },
}));
vi.mock("./score-viewer", () => ({ ScoreViewer: () => null }));
vi.mock("./score-player", () => ({ ScorePlayer: () => null }));
vi.mock("./score-mixier", () => ({ ScoreMixier: () => null }));
vi.mock("./virtual-keyboard", () => ({ VirtualKeyboard: () => null }));

afterEach(() => {
  resources.controllers.length = 0;
  resources.highlighters.length = 0;
  vi.unstubAllGlobals();
});
const score = (id: number) =>
  ({ id, data: {} }) as Parameters<typeof ShowScore>[0]["score"];

test("effect owns and disposes playback resources through StrictMode and score replacement", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(0) })),
  );
  const view = render(
    <StrictMode>
      <ShowScore score={score(1)} />
    </StrictMode>,
  );
  await waitFor(() => expect(resources.controllers.length).toBeGreaterThan(0));
  await waitFor(() => expect(resources.highlighters.length).toBeGreaterThan(0));
  const first = resources.controllers.at(-1)!;
  view.rerender(
    <StrictMode>
      <ShowScore score={score(2)} />
    </StrictMode>,
  );
  await waitFor(() => expect(first.unmount).toHaveBeenCalledOnce());
  view.unmount();
  for (const controller of resources.controllers) {
    expect(controller.mount).toHaveBeenCalledOnce();
    expect(controller.unmount).toHaveBeenCalledOnce();
  }
  for (const highlighter of resources.highlighters) {
    expect(highlighter.highlight).toHaveBeenCalledOnce();
    expect(highlighter.stop).toHaveBeenCalledOnce();
  }
});

test("unmount aborts a pending SoundFont request without creating a controller", () => {
  let signal: AbortSignal | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, options: RequestInit) => {
      signal = options.signal as AbortSignal;
      return new Promise(() => {});
    }),
  );
  const view = render(<ShowScore score={score(1)} />);
  view.unmount();
  expect(signal!.aborted).toBe(true);
  expect(resources.controllers).toHaveLength(0);
});
