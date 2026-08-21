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
  changeMasterGain: Controller["masterGain"]["gain"]["value"];
  changeMute: Controller["isMute"];
};
export class Controller {
  audioContext = new AudioContext();
  emitter = mitt<Events>();
  timer = new Timer(this.audioContext);
  masterGain;
  trackGains = new Map<number, GainNode>();
  presets;
  synths;
  isMute = false;
  previouseGain?: number;
  constructor(
    public score: Audio.Score,
    public soundfont2: Soundfont2,
  ) {
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);
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
    for (const track of this.score.tracks)
      this.trackGains.set(track.id, this.audioContext.createGain());
  }
  play() {
    this.timer.play();
    if (this.audioContext.state === "suspended") this.audioContext.resume();
    for (const track of this.score.tracks) {
      // TODO: playするたびにcreateGainをしていると音が大きくなるバグが発生する
      const synth = this.synths.find((synth) => synth.track.id === track.id)!;
      const trackGain = this.trackGains.get(track.id)!;
      track.emitter.on(
        "changeGain",
        (value: number) => (trackGain.gain.value = value),
      );
      track.emitter.on("changeMute", (value) => {
        trackGain.gain.value = value ? 0 : track.gain;
      });
      trackGain?.connect(this.masterGain);
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
  mute() {
    this.isMute = true;
    this.emitter.emit("changeMute", this.isMute);
    this.previouseGain = this.masterGain.gain.value;
    this.setMasterGain(0);
  }
  unmute() {
    this.isMute = false;
    this.emitter.emit("changeMute", this.isMute);
    if (this.previouseGain) this.setMasterGain(this.previouseGain);
  }
  setMasterGain(value: typeof this.masterGain.gain.value) {
    this.emitter.emit("changeMasterGain", value);
    this.masterGain.gain.value = value;
  }
  unmount() {
    this.audioContext.close();
  }
}
