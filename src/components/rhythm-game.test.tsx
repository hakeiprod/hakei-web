import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import sheet from "@/s-core/fixtures/import/quarter-sheet.json";
const mocks = vi.hoisted(() => ({
  dispose: vi.fn(),
  connect: vi.fn(),
  finish: undefined as undefined | ((snapshot: unknown) => void),
  save: vi.fn(),
  begin: vi.fn(),
  record: vi.fn(),
}));
vi.mock("@/app/actions/practice", () => ({
  savePractice: mocks.save,
  beginPractice: mocks.begin,
  markPracticeRecording: mocks.record,
}));
vi.mock("@/s-core/models/files/soundfont2", () => ({
  default: { create: () => ({}) },
}));
vi.mock("@/s-core/models/browser/midi-recorder", () => ({
  MidiRecorder: class {
    status = "CONNECTED";
    devices = [{ id: "p", name: "Piano" }];
    constructor(private deps: { onChange: () => void }) {}
    connect = async () => {
      mocks.connect();
      this.deps.onChange();
    };
    select = async () => {};
    dispose = mocks.dispose;
  },
}));
vi.mock("@/s-core/models/browser/practice-clock", () => ({
  PracticeClock: class {},
}));
vi.mock("@/s-core/models/browser/audio/controller", () => ({
  Controller: class {
    audioContext = { resume: async () => {} };
    mount() {}
    unmount() {}
    stop() {}
    playTimeline() {}
  },
}));
vi.mock("@/s-core/models/browser/practice-session", () => ({
  PracticeSession: class {
    state = "COMPLETED";
    constructor(deps: { onFinish: (snapshot: unknown) => void }) {
      mocks.finish = deps.onFinish;
    }
    start = async () => {};
    dispose() {}
  },
}));
import { RhythmGame } from "./rhythm-game";
import { evaluateGame } from "@/s-core/models/practice/game-evaluation";
const properties = {
  score: { id: 1, repositoryId: "repo", revisionId: "revision", data: sheet },
  rule: {
    id: "rule",
    version: 1,
    practiceWindowUs: 150_000,
    perfectWindowUs: 30_000,
    goodWindowUs: 60_000,
  },
};
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  mocks.finish = undefined;
});
it("displays the conditions before recording and cleans up MIDI on logout/unmount", () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
  const view = render(<RhythmGame {...properties} />);
  expect(screen.getByRole("button", { name: /対象トラック/ })).toBeDefined();
  expect(screen.getByLabelText("開始小節")).toBeDefined();
  expect(screen.getByText(/最高判定±30ms/)).toBeDefined();
  view.unmount();
  expect(mocks.dispose).toHaveBeenCalled();
});
it("keeps failed recording data and retries the same client session and event batch", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(new Uint8Array([1]))),
  );
  mocks.begin.mockResolvedValue({ ok: true, data: { sessionId: "s" } });
  mocks.record.mockResolvedValue({ ok: true, data: { sessionId: "s" } });
  mocks.save.mockResolvedValue({ ok: false, error: { message: "保存失敗" } });
  render(<RhythmGame {...properties} />);
  fireEvent.click(screen.getByRole("button", { name: "MIDI入力を接続" }));
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: /入力機器/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  fireEvent.keyDown(screen.getByRole("button", { name: /入力機器/ }), {
    key: "ArrowDown",
  });
  fireEvent.click(await screen.findByRole("option", { name: "Piano" }));
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "演奏を開始" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "演奏を開始" }));
  await waitFor(() => expect(mocks.finish).toBeDefined());
  const { act } = await import("@testing-library/react");
  await act(async () =>
    mocks.finish?.({
      status: "COMPLETED",
      events: [
        {
          sequence: 0,
          type: "NOTE_ON",
          channel: 0,
          pitch: 60,
          velocity: 90,
          relativeUs: 0,
        },
        {
          sequence: 1,
          type: "NOTE_OFF",
          channel: 0,
          pitch: 60,
          velocity: 0,
          relativeUs: 500_000,
        },
      ],
      openNotes: [],
      endedUs: 2_150_000,
    }),
  );
  await screen.findByRole("button", { name: "同じ記録の保存を再試行" });
  expect(
    (screen.getByRole("button", { name: "演奏を開始" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(
    screen.getByRole("button", { name: "同じ記録の保存を再試行" }),
  );
  await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
  expect(mocks.save.mock.calls[0][0]).toEqual(mocks.save.mock.calls[1][0]);
});

it.each(["COMPLETED", "INTERRUPTED"] as const)(
  "accepts the server result for %s and leaves interrupted scores unofficial",
  async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(new Uint8Array([1]))),
    );
    mocks.begin.mockResolvedValue({ ok: true, data: { sessionId: "s" } });
    mocks.record.mockResolvedValue({ ok: true, data: { sessionId: "s" } });
    const game = evaluateGame(
      {
        perNote: [
          {
            noteId: "0:0",
            trackId: 0,
            barNumber: 1,
            pitch: 60,
            onsetUs: 0,
            durationUs: 500_000,
            status: "CORRECT",
            deltaUs: 0,
          },
        ],
        extras: [],
      },
      30_000,
      60_000,
    );
    mocks.save.mockResolvedValue({
      ok: true,
      data: {
        sessionId: "s",
        evaluation: {
          summary: {
            expectedCount: 1,
            correctCount: 1,
            wrongCount: 0,
            missedCount: 0,
            extraCount: 0,
            pitchAccuracy: 1,
            meanAbsTimingUs: 0,
            game,
          },
          perNote: [],
          perBar: [],
          score: status === "COMPLETED" ? 100 : null,
        },
      },
    });
    render(<RhythmGame {...properties} />);
    fireEvent.click(screen.getByRole("button", { name: "MIDI入力を接続" }));
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: /入力機器/ }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
    fireEvent.keyDown(screen.getByRole("button", { name: /入力機器/ }), {
      key: "ArrowDown",
    });
    fireEvent.click(await screen.findByRole("option", { name: "Piano" }));
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "演奏を開始",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: "演奏を開始" }));
    await waitFor(() => expect(mocks.finish).toBeDefined());
    const { act } = await import("@testing-library/react");
    await act(async () =>
      mocks.finish?.({
        status,
        events: [],
        openNotes: [],
        endedUs: status === "COMPLETED" ? 2_060_000 : 0,
      }),
    );
    await screen.findByText("確定したゲーム結果");
    expect(
      screen.getByText(
        status === "COMPLETED"
          ? "得点: 100.00"
          : "中断のため正式スコアはありません。",
      ),
    ).toBeDefined();
    expect(mocks.save.mock.calls[0][0].conditions.mode).toBe("GAME");
  },
);
