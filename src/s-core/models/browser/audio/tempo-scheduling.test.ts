import mitt from "mitt";
import { expect, test, vi } from "vitest";
import * as Audio from "../../audio";
import { Beat, MidiNoteNumber, Tempo as TempoValue } from "../../core/units";
import { Tempo } from "../../core/tempo";
import { TempoMap } from "../../core/tempo-map";
import type Soundfont2 from "../../files/soundfont2";

vi.hoisted(() => {
  class Context {
    currentTime = 10;
    state = "running";
    destination = {};
    createGain = () => ({
      gain: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    });
    close = vi.fn();
    suspend = vi.fn();
    resume = vi.fn();
  }
  vi.stubGlobal("AudioContext", Context);
});
vi.mock("./synth", () => ({
  Synth: class {
    gain = { connect: vi.fn() };
    clearAllScheduled = vi.fn();
    dispose = vi.fn();
    noteOn = vi.fn();
    noteOff = vi.fn();
    constructor(public options: { track: Audio.Track }) {}
    get track() {
      return this.options.track;
    }
  },
}));
import { Controller } from "./controller";

test("schedules note endpoints on the integrated timeline, including a sustained note", () => {
  const tempos = [
    new Tempo({
      start: new Beat(0),
      duration: new Beat(4),
      value: new TempoValue(120),
    }),
    new Tempo({
      start: new Beat(4),
      duration: new Beat(4),
      value: new TempoValue(60),
    }),
    new Tempo({
      start: new Beat(8),
      duration: new Beat(4),
      value: new TempoValue(240),
    }),
  ];
  const note = {
    start: new Beat(3),
    end: new Beat(9),
    pitch: new MidiNoteNumber(60),
    emitter: mitt(),
    isLast: true,
  };
  const later = { ...note, start: new Beat(6), end: new Beat(7) };
  const track = {
    id: 0,
    preset: { value: 0 },
    notes: [note, later],
    emitter: mitt(),
    gain: new Audio.Units.Gain(1),
  };
  const score = {
    tracks: [track],
    tempoMap: new TempoMap(tempos),
  } as unknown as Audio.Score;
  const controller = new Controller(
    score,
    { getPreset: () => ({}) } as unknown as Soundfont2,
    new Audio.Units.Gain(1),
  );
  controller.play();
  expect(controller.synths[0].noteOn).toHaveBeenNthCalledWith(
    1,
    note.pitch,
    11.5,
    expect.any(Function),
    expect.any(Function),
  );
  expect(controller.synths[0].noteOff).toHaveBeenNthCalledWith(
    1,
    note.pitch,
    16.25,
  );
  expect(controller.synths[0].noteOn).toHaveBeenNthCalledWith(
    2,
    note.pitch,
    14,
    expect.any(Function),
    expect.any(Function),
  );
  expect(controller.synths[0].noteOff).toHaveBeenNthCalledWith(
    2,
    note.pitch,
    15,
  );
  controller.unmount();
});
