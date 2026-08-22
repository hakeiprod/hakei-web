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
  mount() {
    this.emitter.on("changeMute", (value) => {
      this.masterGainNode.gain.value = value ? 0 : this.masterGain.value;
    });
    this.emitter.on("changeMasterGain", (gain) => {
      this.masterGainNode.gain.value = gain.value;
    });
  }
  play() {
    this.timer.play();
    if (this.audioContext.state === "suspended") this.audioContext.resume();
    for (const track of this.score.tracks) {
      const synth = this.synths.find((synth) => synth.track.id === track.id)!;
      const trackGain = this.trackGainNodes.get(track.id)!;
      track.emitter.on(
        "changeGain",
        (gain: Audio.Units.Gain) => (trackGain.gain.value = gain.value),
      );
      track.emitter.on("changeMute", (value) => {
        trackGain.gain.value = value ? 0 : track.gain.value;
      });
      trackGain?.connect(this.masterGainNode);
      synth.gain.connect(trackGain);
      if (isNonNullish(this.timer.startSeconds))
        for (const note of track.notes) {
          synth.noteOn(
            note.pitch,
            this.timer.startSeconds.add(note.start.toSeconds(note.tempo.value))
              .value,
            () => note.emitter.emit("noteOn"),
            () => {
              note.emitter.emit("noteOff");
              if (note.isLast) this.emitter.emit("end");
            },
          );
          synth.noteOff(
            note.pitch,
            this.timer.startSeconds.add(note.end.toSeconds(note.tempo.value))
              .value,
          );
        }
    }
  }
  resume() {
    this.timer.resume();
    this.audioContext.resume();
  }
  pause() {
    this.timer.pause();
    this.emitter.emit("pause");
    this.audioContext.suspend();
  }
  stop() {
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
    this.audioContext.close();
  }
}
