/* eslint-disable unicorn/consistent-function-scoping -- Port methods depend on the test instance. */
import { afterEach, expect, it, vi } from "vitest";
import { PracticeSession } from "./practice-session";
import { PracticeClock } from "./practice-clock";
import { MidiRecorder } from "./midi-recorder";
import type { PracticeTimeline } from "../practice/contracts";
class Port extends EventTarget {
  id = "p";
  name = "Piano";
  state = "connected";
  connection = "open";
  open = async () => this;
  close = vi.fn(async () => this);
}
const timeline: PracticeTimeline = {
  bars: [{ barNumber: 1, startUs: 0, endUs: 1_000_000 }],
  notes: [
    {
      noteId: "0:0",
      trackId: 0,
      barNumber: 1,
      pitch: 60,
      onsetUs: 0,
      durationUs: 500_000,
    },
  ],
  continuations: [],
  durationUs: 1_000_000,
  rangeStartBeat: 0,
  rangeEndBeat: 2,
};
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it("interrupts on backgrounding and releases timers, subscriptions and sound", async () => {
  vi.useFakeTimers();
  const port = new Port(),
    access = Object.assign(new EventTarget(), {
      inputs: new Map([[port.id, port]]),
    });
  let now = 1000;
  const stopped = vi.fn(),
    finished = vi.fn();
  const recorder = new MidiRecorder({ request: async () => access });
  await recorder.connect();
  await recorder.select(port.id);
  const clock = new PracticeClock(
    { state: "running", currentTime: 0, resume: async () => {} },
    () => now,
  );
  const session = new PracticeSession({
    recorder,
    clock,
    play: vi.fn(),
    stopAudio: stopped,
    document,
    now: () => now,
    onFinish: finished,
  });
  await session.start(timeline, 150_000, 0);
  now = 1100;
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  document.dispatchEvent(new Event("visibilitychange"));
  expect(session.state).toBe("INTERRUPTED");
  expect(stopped).toHaveBeenCalledOnce();
  expect(port.close).toHaveBeenCalled();
  expect(finished.mock.calls[0][0].endedUs).toBe(100_000);
  expect(vi.getTimerCount()).toBe(0);
  session.dispose();
});
it("disposal while resume is pending never starts capture or playback", async () => {
  let resolve!: () => void;
  const play = vi.fn(),
    recorder = new MidiRecorder({
      request: async () =>
        Object.assign(new EventTarget(), { inputs: new Map() }),
    });
  const clock = new PracticeClock(
    {
      state: "running",
      currentTime: 0,
      resume: () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    },
    () => 1000,
  );
  const session = new PracticeSession({
    recorder,
    clock,
    play,
    stopAudio: vi.fn(),
  });
  const pending = session.start(timeline, 150_000, 0);
  session.dispose();
  resolve();
  await expect(pending).rejects.toThrow();
  expect(play).not.toHaveBeenCalled();
});
it("waits for the calibration-adjusted capture tail before completing", async () => {
  vi.useFakeTimers();
  const port = new Port(),
    access = Object.assign(new EventTarget(), {
      inputs: new Map([[port.id, port]]),
    });
  let now = 1000;
  const recorder = new MidiRecorder({ request: async () => access });
  await recorder.connect();
  await recorder.select(port.id);
  const clock = new PracticeClock(
    { state: "running", currentTime: 0, resume: async () => {} },
    () => now,
  );
  const session = new PracticeSession({
    recorder,
    clock,
    play: vi.fn(),
    stopAudio: vi.fn(),
    now: () => now,
  });
  await session.start(timeline, 450_000, 0);
  now = 2200;
  vi.advanceTimersByTime(16);
  expect(session.state).toBe("RECORDING");
  now = 2450;
  vi.advanceTimersByTime(16);
  expect(session.state).toBe("COMPLETED");
  session.dispose();
});
