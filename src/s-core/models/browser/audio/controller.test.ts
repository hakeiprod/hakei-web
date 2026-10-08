import mitt from "mitt";
import { afterEach, describe, expect, test, vi } from "vitest";
import * as Audio from "../../audio";
import type Soundfont2 from "../../files/soundfont2";

// Keep the Web Audio mock inside the hoisted setup so it exists before imports.
/* eslint-disable unicorn/consistent-function-scoping */
vi.hoisted(() => {
  class Context {
    currentTime = 0;
    state = "running";
    destination = {};
    createGain = vi.fn(() => ({
      gain: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }));
    resume = vi.fn(() => {
      this.state = "running";
    });
    suspend = vi.fn(async () => {
      this.state = "suspended";
    });
    close = vi.fn(async () => {
      this.state = "closed";
    });
  }
  vi.stubGlobal("AudioContext", Context);
});
/* eslint-enable unicorn/consistent-function-scoping */
vi.mock("./synth", () => ({
  Synth: class {
    gain = { connect: vi.fn(), disconnect: vi.fn() };
    clearAllScheduled = vi.fn();
    dispose = vi.fn();
    constructor(public options: { track: Audio.Track }) {}
    get track() {
      return this.options.track;
    }
  },
}));
import { Controller } from "./controller";

afterEach(() => vi.clearAllMocks());
function setup() {
  const track = {
    id: 0,
    preset: { value: 0 },
    notes: [],
    isMute: false,
    gain: new Audio.Units.Gain(0.4),
    emitter: mitt<{ changeGain: Audio.Units.Gain; changeMute: boolean }>(),
  };
  const score = new Audio.Score({
    tracks: [track] as unknown as Audio.Track[],
    notes: [],
    tempos: [],
    timesignatures: [],
    keysignatures: [],
    masterbars: [],
  });
  const soundfont = { getPreset: () => ({}) } as unknown as Soundfont2;
  return {
    track,
    controller: new Controller(score, soundfont, new Audio.Units.Gain(0.7)),
  };
}

describe("playback lifetime", () => {
  test("repeated mount and playback do not duplicate subscriptions or connections", () => {
    const { track, controller } = setup();
    controller.mount();
    controller.mount();
    controller.play();
    controller.stop();
    controller.play();
    expect(track.emitter.all.get("changeGain")).toHaveLength(1);
    expect(track.emitter.all.get("changeMute")).toHaveLength(1);
    expect(controller.trackGainNodes.get(0)!.connect).toHaveBeenCalledTimes(1);
    expect(controller.masterGainNode.gain.value).toBe(0.7);
    controller.unmount();
  });
  test("disposal releases owned resources once and preserves another subscriber", () => {
    const { track, controller } = setup();
    const external = vi.fn();
    track.emitter.on("changeMute", external);
    controller.mount();
    controller.play();
    controller.unmount();
    controller.unmount();
    controller.play();
    track.emitter.emit("changeMute", true);
    expect(external).toHaveBeenCalledOnce();
    expect(track.emitter.all.get("changeGain")).toHaveLength(0);
    expect(controller.audioContext.close).toHaveBeenCalledOnce();
    expect(controller.synths[0].dispose).toHaveBeenCalledOnce();
    expect(controller.trackGainNodes.get(0)!.disconnect).toHaveBeenCalledOnce();
  });
  test("changing master volume keeps a muted output silent", () => {
    const { controller } = setup();
    controller.mount();
    controller.setMute(true);
    controller.setMasterGain(new Audio.Units.Gain(0.8));
    expect(controller.masterGainNode.gain.value).toBe(0);
    controller.setMute(false);
    expect(controller.masterGainNode.gain.value).toBe(0.8);
    controller.unmount();
  });
  test("stop and replay after a pause reset elapsed playback time", () => {
    const { controller } = setup();
    controller.play();
    Object.assign(controller.audioContext, { currentTime: 4 });
    controller.pause();
    Object.assign(controller.audioContext, { currentTime: 7 });
    controller.resume();
    Object.assign(controller.audioContext, { currentTime: 9 });
    expect(controller.timer.elapsedSeconds.value).toBe(6);
    controller.stop();
    expect(controller.timer.elapsedSeconds.value).toBe(0);
    controller.play();
    expect(controller.timer.elapsedSeconds.value).toBe(0);
    controller.unmount();
  });
});
