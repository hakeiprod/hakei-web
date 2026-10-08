import mitt from "mitt";
import { isNonNullish, map, pipe, prop, unique } from "remeda";
import * as BrowserAudio from ".";
import "../../../extensions/audioContext/get-current-seconds.extensions";
import * as Audio from "../../audio";
import Soundfont2 from "../../files/soundfont2";
import { Timer } from "./timer";

export enum ControllerState {
  Playing,
  Paused,
  Stopped,
}
type Events = {
  pause?: undefined;
  stop?: undefined;
  end?: undefined;
  changeMasterGain: Audio.Units.Gain;
  changeMute: Controller["isMute"];
};
export class Controller {
  private mounted = false;
  private disposed = false;
  private subscriptions: (() => void)[] = [];
  audioContext = new AudioContext();
  emitter = mitt<Events>();
  timer = new Timer(this.audioContext);
  masterGainNode;
  trackGainNodes = new Map<number, GainNode>();
  presets;
  synths;
  isMute = false;
  masterGain;
  constructor(
    public score: Audio.Score,
    public soundfont2: Soundfont2,
    defaultMasterGain: Audio.Units.Gain,
  ) {
    this.masterGain = defaultMasterGain;
    this.masterGainNode = this.audioContext.createGain();
    this.masterGainNode.connect(this.audioContext.destination);
    for (const track of this.score.tracks)
      this.trackGainNodes.set(track.id, this.audioContext.createGain());
    this.presets = pipe(
      score.tracks,
      map(prop("preset", "value")),
      unique(),
      map((value) => this.soundfont2.getPreset(value)),
    );
    this.synths = this.score.tracks.map(
      (track) =>
        new BrowserAudio.Synth({
          audioContext: this.audioContext,
          preset: this.soundfont2.getPreset(track.preset.value),
          track,
        }),
    );
  }
  private updateMasterGain = () => {
    this.masterGainNode.gain.value = this.isMute ? 0 : this.masterGain.value;
  };
  mount() {
    if (this.mounted || this.disposed) return;
    this.mounted = true;
    this.updateMasterGain();
    this.emitter.on("changeMute", this.updateMasterGain);
    this.emitter.on("changeMasterGain", this.updateMasterGain);
    this.subscriptions.push(() => {
      this.emitter.off("changeMute", this.updateMasterGain);
      this.emitter.off("changeMasterGain", this.updateMasterGain);
    });
    for (const track of this.score.tracks) {
      const synth = this.synths.find((synth) => synth.track.id === track.id)!;
      const trackGain = this.trackGainNodes.get(track.id)!;
      const updateGain = (gain: Audio.Units.Gain) => {
        trackGain.gain.value = track.isMute ? 0 : gain.value;
      };
      const updateMute = () => updateGain(track.gain);
      updateMute();
      track.emitter.on("changeGain", updateGain);
      track.emitter.on("changeMute", updateMute);
      this.subscriptions.push(() => {
        track.emitter.off("changeGain", updateGain);
        track.emitter.off("changeMute", updateMute);
      });
      trackGain.connect(this.masterGainNode);
      synth.gain.connect(trackGain);
    }
  }
  play() {
    if (this.disposed) return;
    this.mount();
    for (const synth of this.synths) synth.clearAllScheduled();
    this.timer.play();
    if (this.audioContext.state === "suspended") this.audioContext.resume();
    const tempoMap = this.score.tempoMap;
    for (const track of this.score.tracks) {
      const synth = this.synths.find((synth) => synth.track.id === track.id)!;
      if (isNonNullish(this.timer.startSeconds))
        for (const note of track.notes) {
          synth.noteOn(
            note.pitch,
            this.timer.startSeconds.add(tempoMap.beatToSeconds(note.start))
              .value,
            () => note.emitter.emit("noteOn"),
            () => {
              note.emitter.emit("noteOff");
              if (note.isLast) this.emitter.emit("end");
            },
          );
          synth.noteOff(
            note.pitch,
            this.timer.startSeconds.add(tempoMap.beatToSeconds(note.end)).value,
          );
        }
    }
  }
  resume() {
    if (this.disposed) return;
    this.timer.resume();
    this.audioContext.resume();
  }
  pause() {
    if (this.disposed) return;
    this.timer.pause();
    this.emitter.emit("pause");
    this.audioContext.suspend();
  }
  stop() {
    if (this.disposed) return;
    this.timer.stop();
    this.emitter.emit("stop");
    this.audioContext.suspend();
    for (const synth of this.synths) synth.clearAllScheduled();
  }
  setMute(value: typeof this.isMute) {
    this.isMute = value;
    this.emitter.emit("changeMute", value);
  }
  setMasterGain(value: Audio.Units.Gain) {
    this.masterGain = value;
    this.emitter.emit("changeMasterGain", value);
  }
  unmount() {
    if (this.disposed) return;
    this.disposed = true;
    this.timer.stop();
    for (const unsubscribe of this.subscriptions) unsubscribe();
    this.subscriptions = [];
    for (const synth of this.synths) synth.dispose();
    for (const node of this.trackGainNodes.values()) node.disconnect();
    this.masterGainNode.disconnect();
    this.audioContext.close();
  }
}
