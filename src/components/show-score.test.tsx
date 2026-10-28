import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import * as Core from "@/s-core/models/core";
const viewerProbe = vi.hoisted(() => ({
  onReady: undefined as ((score: unknown) => void) | undefined,
  onStatusChange: undefined as ((ready: boolean) => void) | undefined,
}));
vi.mock("next/font/local", () => ({
  default: () => ({ className: "bravura", style: { fontFamily: "Bravura" } }),
}));
vi.mock("./score-viewer", () => ({
  ScoreViewer: ({
    score,
    source,
    onReady,
    onStatusChange,
  }: {
    score?: { notes: { pitch: { value: number } | null; rest: boolean }[] };
    source?: { data: { notes: { pitch: number | null; rest: boolean }[] } };
    onReady?: (score: unknown) => void;
    onStatusChange?: (ready: boolean) => void;
  }) => {
    viewerProbe.onReady = onReady;
    viewerProbe.onStatusChange = onStatusChange;
    return (
      <>
        <button data-testid="viewer-controls">表示方式</button>
        {(source || score) && (
          <div data-testid="notes">
            {(source?.data.notes ?? score?.notes ?? [])
              .filter((note) => !note.rest)
              .map((note) =>
                typeof note.pitch === "number"
                  ? note.pitch
                  : (note.pitch?.value ?? "unpitched"),
              )
              .join(",")}
          </div>
        )}
      </>
    );
  },
}));
vi.mock("./score-player", () => ({ ScorePlayer: () => null }));
vi.mock("./score-mixier", () => ({ ScoreMixier: () => null }));
vi.mock("./virtual-keyboard", () => ({ VirtualKeyboard: () => null }));
import { ShowScore } from "./show-score";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("starts soundfont loading only after score publication and cancels it if rendering resumes", async () => {
  const { default: data } = await import("@/s-core/fixtures/import/quarter-sheet.json");
  const fetchSoundfont = vi.fn(() => new Promise<Response>(() => {}));
  vi.stubGlobal("fetch", fetchSoundfont);
  const view = render(<ShowScore score={{ data }} />);
  expect(fetchSoundfont).not.toHaveBeenCalled();
  await act(async () => viewerProbe.onStatusChange?.(true));
  expect(fetchSoundfont).toHaveBeenCalledOnce();
  const signal = (fetchSoundfont.mock.calls[0] as unknown as [string, { signal: AbortSignal }])[1].signal;
  expect(signal.aborted).toBe(false);
  await act(async () => viewerProbe.onStatusChange?.(false));
  expect(signal.aborted).toBe(true);
  view.unmount();
});

test("lets the published score paint before preparing audio and cancels that preparation on unmount", async () => {
  const { default: data } =
    await import("@/s-core/fixtures/import/quarter-sheet.json");
  const Engraving = await import("@/s-core/models/engraving");
  const score = Engraving.Score.import(
    Core.Score.create({
      tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }],
    }).toSheet().export(),
  );
  const prepareAudio = vi.spyOn(score, "toAudioSteps");
  const backgroundTasks: (() => void)[] = [];
  const postTask = vi.fn((callback: () => void, options: { priority: string }) => {
    expect(options.priority).toBe("background");
    return new Promise<void>((resolve) => backgroundTasks.push(() => { callback(); resolve(); }));
  });
  vi.stubGlobal("scheduler", { postTask });
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
  const paint = async () => {
    const pending = [...frames];
    frames.clear();
    await act(async () => {
      for (const [, callback] of pending) callback(performance.now());
    });
  };
  const view = render(<ShowScore score={{ data }} />);
  await act(async () => viewerProbe.onReady?.(score));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
  expect(prepareAudio).not.toHaveBeenCalled();
  await paint();
  expect(prepareAudio).not.toHaveBeenCalled();
  await paint();
  expect(prepareAudio).not.toHaveBeenCalled();
  expect(postTask).toHaveBeenCalledOnce();
  await act(async () => backgroundTasks.shift()?.());
  expect(prepareAudio).toHaveBeenCalledOnce();
  view.unmount();
  backgroundTasks.length = 0;

  prepareAudio.mockClear();
  const pending = render(<ShowScore score={{ data }} />);
  await act(async () => viewerProbe.onReady?.(score));
  expect(frames.size).toBeGreaterThan(0);
  await paint();
  await paint();
  expect(backgroundTasks).toHaveLength(1);
  pending.unmount();
  await act(async () => backgroundTasks.shift()?.());
  await paint();
  await paint();
  expect(prepareAudio).not.toHaveBeenCalled();
  prepareAudio.mockRestore();
});
test("empty and invalid score data have explicit states", async () => {
  const view = render(
    <ShowScore
      score={{
        data: {
          notes: [],
          tracks: [],
          timesignatures: [],
          keysignatures: [],
          tempos: [],
          bars: [],
          masterbars: [],
          staves: [],
          chords: [],
          slots: [],
          rows: [],
        },
      }}
    />,
  );
  expect(
    await screen.findByText("この楽譜には音符がありません。"),
  ).toBeDefined();
  view.rerender(<ShowScore score={{ data: { notes: [] } }} />);
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("修正が必要");
});
test("viewing preserves fixture pitches and needs no MIDI access", async () => {
  const midi = vi.fn();
  vi.stubGlobal("navigator", { requestMIDIAccess: midi });
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
  const exported = Core.Score.create({
    tracks: [
      {
        notes: [
          { pitch: 60, start: 0, duration: 1 },
          { pitch: 64, start: 1, duration: 1 },
        ],
      },
    ],
  })
    .toSheet()
    .export();
  // The viewer receives JSON read from Git, not live Beat instances in an export.
  // eslint-disable-next-line unicorn/prefer-structured-clone
  const data = JSON.parse(JSON.stringify(exported));
  const original = structuredClone(data);
  render(<ShowScore score={{ data, revisionNumber: 2 }} />);
  const notes = await screen.findByTestId("notes");
  expect(notes.textContent).toBe("60,64");
  expect(screen.getByText("版 2")).toBeDefined();
  expect(data).toEqual(original);
  expect(midi).not.toHaveBeenCalled();
});

test("unpitched percussion displays without constructing audio or fetching a soundfont", async () => {
  const { readFile } = await import("node:fs/promises");
  const { convertScore } = await import("@/s-core/models/import/convert");
  const result = await convertScore({
    bytes: await readFile("src/s-core/fixtures/tab-drum/drums/snare.musicxml"),
    options: { mode: "PRESERVE" },
  });
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  render(<ShowScore score={{ data: result.candidate }} />);
  const notes = await screen.findByTestId("notes");
  expect(notes.textContent).toContain("unpitched");
  expect(fetcher).not.toHaveBeenCalled();
  expect(screen.getByText(/打楽器譜は表示できます/)).toBeTruthy();
});

test("passes a source snapshot to the viewer without synchronous model imports during React render", async () => {
  const { default: snapshot } =
    await import("@/s-core/fixtures/import/quarter-sheet.json");
  const Engraving = await import("@/s-core/models/engraving");
  const Sheet = await import("@/s-core/models/sheet");
  const engravingImport = vi.spyOn(Engraving.Score, "import");
  const sheetImport = vi.spyOn(Sheet.Score, "import");
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
  const original = structuredClone(snapshot);
  try {
    render(<ShowScore score={{ data: snapshot, revisionNumber: 3 }} />);
    await screen.findByTestId("notes");
    expect(engravingImport).not.toHaveBeenCalled();
    expect(sheetImport).not.toHaveBeenCalled();
    expect(snapshot).toEqual(original);
  } finally {
    engravingImport.mockRestore();
    sheetImport.mockRestore();
  }
});

test("reuses an immutable persisted revision across read-only server responses and rebuilds for a new revision", async () => {
  const { default: data } =
    await import("@/s-core/fixtures/import/quarter-sheet.json");
  const adapter = await import("@/s-core/models/browser/render-score");
  const snapshot = vi.spyOn(adapter, "tryCreateSmallSourceSnapshot");
  const deferred = vi.spyOn(adapter, "createSourceSnapshot");
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
  try {
    const view = render(
      <ShowScore
        score={{ id: 91, revisionId: "first", revisionNumber: 1, data }}
      />,
    );
    await screen.findByTestId("notes");
    expect(snapshot.mock.calls.length + deferred.mock.calls.length).toBe(1);
    view.rerender(
      <ShowScore
        score={{
          id: 91,
          revisionId: "first",
          revisionNumber: 1,
          data: structuredClone(data),
        }}
      />,
    );
    await screen.findByTestId("notes");
    expect(snapshot.mock.calls.length + deferred.mock.calls.length).toBe(1);
    const changed = structuredClone(data);
    changed.notes[0].pitch = 67;
    view.rerender(
      <ShowScore
        score={{
          id: 91,
          revisionId: "second",
          revisionNumber: 2,
          data: changed,
        }}
      />,
    );
    await screen.findByText("67");
    expect(snapshot.mock.calls.length + deferred.mock.calls.length).toBe(2);
  } finally {
    snapshot.mockRestore();
    deferred.mockRestore();
  }
});

test("validates a complete Sheet without constructing partial-format errors for every note", async () => {
  const { default: data } =
    await import("@/s-core/fixtures/import/quarter-sheet.json");
  const { partialScoreSchema } =
    await import("@/s-core/models/import/contracts");
  const partial = vi.spyOn(partialScoreSchema, "safeParse");
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
  try {
    render(<ShowScore score={{ data }} />);
    await screen.findByTestId("notes");
    expect(partial).not.toHaveBeenCalled();
  } finally {
    partial.mockRestore();
  }
});

test("captures complete input before suspension even if its caller mutates it", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
  const exported = Core.Score.create({
    tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }],
  })
    .toSheet()
    .export();
  // Exercise persisted JSON serialization, including unit values.
  // eslint-disable-next-line unicorn/prefer-structured-clone
  const data = JSON.parse(JSON.stringify(exported));
  render(<ShowScore score={{ data }} />);
  data.notes[0].pitch = 72;
  const notes = await screen.findByTestId("notes");
  expect(notes.textContent).toBe("60");
});

test("mounts controls while validation is pending and reuses them when the snapshot arrives", async () => {
  const { default: data } =
    await import("@/s-core/fixtures/import/quarter-sheet.json");
  const adapter = await import("@/s-core/models/browser/render-score");
  const source = await adapter.createSourceSnapshot(data);
  let finish!: (value: typeof source) => void;
  const pending = new Promise<typeof source>((resolve) => {
    finish = resolve;
  });
  const bounded = vi
    .spyOn(adapter, "tryCreateSmallSourceSnapshot")
    .mockImplementation((): undefined => {
      /* Exercise the asynchronous input path. */
    });
  const capture = vi
    .spyOn(adapter, "createSourceSnapshot")
    .mockReturnValueOnce(pending);
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
  try {
    render(<ShowScore score={{ id: 99, revisionId: "first", data }} />);
    const controls = screen.getByTestId("viewer-controls");
    expect(screen.queryByTestId("notes")).toBeNull();
    await act(async () => finish(source));
    await screen.findByTestId("notes");
    expect(screen.getByTestId("viewer-controls")).toBe(controls);
  } finally {
    capture.mockRestore();
    bounded.mockRestore();
  }
});

test("captures a bounded complete score in the initial state without another validation task", async () => {
  const { default: data } =
    await import("@/s-core/fixtures/import/quarter-sheet.json");
  const adapter = await import("@/s-core/models/browser/render-score");
  const deferred = vi.spyOn(adapter, "createSourceSnapshot");
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
  try {
    render(<ShowScore score={{ data }} />);
    expect(screen.getByTestId("notes").textContent).not.toBe("");
    expect(deferred).not.toHaveBeenCalled();
  } finally {
    deferred.mockRestore();
  }
});

test("suspends playback highlighting during updates, reconnects only the published score and cancels frames on exit", async () => {
  const adapter = await import("@/s-core/models/browser/render-score");
  const BrowserAudio = await import("@/s-core/models/browser/audio");
  const { NoteHighlighter } =
    await import("@/s-core/models/audio_sheet/note-highlighter");
  const { default: Soundfont2 } =
    await import("@/s-core/models/files/soundfont2");
  const { LayoutType } = await import("@/s-core/models/sheet");
  const data = Core.Score.create({
    tracks: [
      {
        notes: [
          { pitch: 60, start: 0, duration: 2 },
          { pitch: 64, start: 2, duration: 2 },
        ],
      },
    ],
  })
    .toSheet()
    .export();
  const source = await adapter.createSourceSnapshot(data);
  const options = {
    scale: 12,
    layoutType: LayoutType.Horizontal,
    advanced: true,
    debug: false,
  };
  const first = await adapter.renderScore(source, options);
  const second = await adapter.renderScore(source, { ...options, scale: 18 });
  first.selectPage(0);
  second.selectPage(0);
  const firstSVG = first.pages[0],
    secondSVG = second.pages[0];
  const controller = {
    timer: { elapsedSeconds: { value: 0 } },
    mount: vi.fn(),
    unmount: vi.fn(),
  } as unknown as InstanceType<typeof BrowserAudio.Controller>;
  vi.spyOn(BrowserAudio, "Controller").mockImplementation(
    class {
      constructor() {
        return controller;
      }
    } as unknown as typeof BrowserAudio.Controller,
  );
  vi.spyOn(Soundfont2, "create").mockReturnValue(
    Object.create(Soundfont2.prototype),
  );
  vi.stubGlobal("AudioContext", class {});
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(0) }),
  );
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  const highlight = vi.spyOn(NoteHighlighter.prototype, "highlight");
  const stop = vi.spyOn(NoteHighlighter.prototype, "stop");
  const paint = async () => {
    const pending = [...frames.values()];
    frames.clear();
    await act(async () => {
      for (const callback of pending) callback(performance.now());
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };
  const view = render(<ShowScore score={{ data }} />);
  try {
    await act(async () => {
      viewerProbe.onReady?.(first.score);
      viewerProbe.onStatusChange?.(true);
    });
    await waitFor(async () => {
      await paint();
      expect(controller.mount).toHaveBeenCalledOnce();
      expect(highlight).toHaveBeenCalled();
    });
    expect(
      (highlight.mock.contexts.at(-1) as InstanceType<typeof NoteHighlighter>)
        .sheet,
    ).toBe(first.score);
    // Exercise the same animation owned by playback, with a controlled audio clock.
    const running = highlight.mock.contexts.at(-1) as InstanceType<
      typeof NoteHighlighter
    >;
    running.highlight(true);
    expect(frames.size).toBe(1);
    const retained = firstSVG.outerHTML;
    await act(async () => viewerProbe.onStatusChange?.(false));
    expect(stop).toHaveBeenLastCalledWith({ preserveClasses: true });
    expect(frames.size).toBe(0);
    expect(firstSVG.outerHTML).toBe(retained);
    const count = highlight.mock.calls.length;
    await paint();
    expect(highlight).toHaveBeenCalledTimes(count);
    // The real Viewer's disposal/late-result contract is covered by its tests.
    first.dispose();
    await act(async () => {
      viewerProbe.onReady?.(second.score);
      viewerProbe.onStatusChange?.(true);
    });
    expect(
      (highlight.mock.contexts.at(-1) as InstanceType<typeof NoteHighlighter>)
        .sheet,
    ).toBe(second.score);
    const retired = firstSVG.outerHTML;
    const latest = highlight.mock.contexts.at(-1) as InstanceType<
      typeof NoteHighlighter
    >;
    controller.timer.elapsedSeconds.value = 10_000;
    latest.highlight(false);
    expect(firstSVG.outerHTML).toBe(retired);
    expect(secondSVG.querySelectorAll(".note-highlight")).toHaveLength(0);
    controller.timer.elapsedSeconds.value = 0;
    latest.highlight(true);
    expect(
      secondSVG.querySelectorAll(".note-highlight").length,
    ).toBeGreaterThan(0);
    expect(frames.size).toBe(1);
    view.unmount();
    expect(frames.size).toBe(0);
    expect(controller.unmount).toHaveBeenCalledOnce();
    const afterUnmount = highlight.mock.calls.length;
    await paint();
    expect(highlight).toHaveBeenCalledTimes(afterUnmount);
    expect(
      first.score.notes.every((note) => !note.glyph.onClassListChange),
    ).toBe(true);
  } finally {
    view.unmount();
    first.dispose();
    second.dispose();
    vi.restoreAllMocks();
  }
});
