import { afterEach, expect, test, vi } from "vitest";
import { MidiNoteNumber } from "../../core/units";
import { Synth } from "./synth";

afterEach(() => {
  vi.useRealTimers();
});
test("stopping scheduled playback cancels callbacks, sources and automation", () => {
  vi.useFakeTimers();
  const source = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    playbackRate: { value: 0 },
    onended: null as (() => void) | null,
  };
  const gain = {
    gain: { cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn() },
    disconnect: vi.fn(),
  };
  const filter = {
    Q: { setValueAtTime: vi.fn() },
    frequency: { cancelScheduledValues: vi.fn() },
    disconnect: vi.fn(),
  };
  // Exercise real scheduling without a SoundFont fixture or an audio device.
  const synth = Object.assign(Object.create(Synth.prototype), {
    startTimers: new Set(),
    endListeners: new Map(),
    bufferSources: [],
    gain,
    filter,
    audioContext: { currentTime: 10, createBufferSource: () => source },
    resources: [
      {
        pitch: new MidiNoteNumber(60),
        buffer: {},
        sample: {
          generators: {
            initialFilterQ: { toDecibel: () => ({ value: 0 }) },
            sampleModes: { value: 0 },
          },
          playBackRate: () => 1,
        },
        gainEnvelope: { noteOn: vi.fn() },
        filterEnvelope: { noteOn: vi.fn() },
      },
    ],
  }) as unknown as Synth;
  const onStart = vi.fn(),
    onEnd = vi.fn();
  synth.noteOn(new MidiNoteNumber(60), 12, onStart, onEnd);
  vi.advanceTimersByTime(1999);
  expect(onStart).not.toHaveBeenCalled();
  synth.clearAllScheduled();
  vi.runAllTimers();
  expect(onStart).not.toHaveBeenCalled();
  expect(onEnd).not.toHaveBeenCalled();
  expect(source.removeEventListener).toHaveBeenCalledWith(
    "ended",
    expect.any(Function),
  );
  expect(source.stop).toHaveBeenCalledOnce();
  expect(source.disconnect).toHaveBeenCalledOnce();
  expect(synth.bufferSources).toHaveLength(0);
  expect(gain.gain.cancelScheduledValues).toHaveBeenCalledWith(10);
  synth.dispose();
  expect(filter.disconnect).toHaveBeenCalledOnce();
});
