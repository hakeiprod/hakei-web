import * as Audio from "../../audio";
import * as BrowserAudio from ".";
import Soundfont2 from "../../files/soundfont2";
import { match } from "ts-pattern";
import { map, pipe, prop, unique } from "remeda";

export enum ControllerState {
  Playing,
  Paused,
  Stopped,
}

export class Controller {
  state: ControllerState = ControllerState.Stopped;
  startTime = 0;
  masterGain;
  audioContext;
  presets;
  synths;
  pausedTime: number | null = null;
  notes: { note: Audio.Note; synth: BrowserAudio.Synth }[] = [];
  timeouts: NodeJS.Timeout[] = [];
  onPlayEnd?: () => void;
  onChangeMasterGain?: (value: typeof this.masterGain.gain.value) => void;
  get elapsedTime() {
    return this.audioContext.currentTime - this.startTime;
  }
  constructor(
    public score: Audio.Score,
    public soundfont2: Soundfont2
  ) {
    this.audioContext = new AudioContext();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);
    this.presets = pipe(
      score.tracks,
      map(prop("preset", "value")),
      unique(),
      map((value) => this.soundfont2.getPreset(value))
    );
    this.synths = this.score.tracks.map(
      (track) =>
        new BrowserAudio.Synth({
          audioContext: this.audioContext,
          preset: this.soundfont2.getPreset(track.preset.value),
          track,
        })
    );
  }
  play() {
    this.startTime = this.audioContext.currentTime;
    // if (this.state === ControllerState.Stopped)
    //   return this.audioContext.resume();
    for (const track of this.score.tracks) {
      const trackGain = this.audioContext.createGain();
      const synth = this.synths.find((synth) => synth.track.id === track.id)!;
      track.onChangeGain = (value: number) => (trackGain.gain.value = value);
      trackGain.connect(this.masterGain);
      synth.gain.connect(trackGain);
      for (const note of track.notes) {
        synth.noteOn(
          note.pitch,
          this.startTime + note.start.toSeconds(note.tempo.value),
          () => {
            if (note.isLast) this.onPlayEnd?.();
          }
        );
        synth.noteOff(
          note.pitch,
          this.startTime + note.end.toSeconds(note.tempo.value)
        );
      }
    }
  }
  pause() {
    this.audioContext.suspend();
  }
  stop() {
    for (const { synth } of this.notes)
      synth.bufferSources.map(({ bufferSource }) => bufferSource.stop());
    this.synths = [];
  }
  setState(state: typeof this.state) {
    match(state)
      .with(ControllerState.Playing as 0, () => this.play())
      .with(ControllerState.Paused as 1, () => this.pause())
      .with(ControllerState.Stopped as 2, () => this.stop())
      .exhaustive();
    this.state = state;
  }
  setMasterGain(value: typeof this.masterGain.gain.value) {
    this.masterGain.gain.value = value;
    this.onChangeMasterGain?.(value);
  }
}
