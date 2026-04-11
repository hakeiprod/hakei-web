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
  timer;
  emitter = mitt<Events>();
  masterGain;
  audioContext;
  presets;
  synths;
  isMute = false;
  previouseGain?: number;
  constructor(
    public score: Audio.Score,
    public soundfont2: Soundfont2,
  ) {
    this.audioContext = new AudioContext();
    this.timer = new Timer(this.audioContext);
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
  }
  play() {
    this.timer.play();
    for (const track of this.score.tracks) {
      const trackGain = this.audioContext.createGain();
      const synth = this.synths.find((synth) => synth.track.id === track.id)!;
      track.emitter.on(
        "changeGain",
        (value: number) => (trackGain.gain.value = value),
      );
      trackGain.connect(this.masterGain);
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
    this.audioContext.close();
    this.synths = [];
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
  // 音が鳴り始める時と終わるときのタイムを羅列とユニークして、そのタイム毎回にactiveNotesを取得してハイライトを反映させる
}
