import * as Audio from "../../audio";
import * as BrowserAudio from ".";
import Soundfont2 from "../../files/soundfont2";

export class Controller {
  startTime = 0;
  masterGain;
  isPlaying = false;
  isPaused = false;
  audioContext;
  pausedTime: number | null = null;
  notes: { note: Audio.Note; synth: BrowserAudio.Synth }[] = [];
  onPlayEnd?: () => void;
  get elapsedTime() {
    return this.audioContext.currentTime - this.startTime;
  }
  constructor(
    public score: Audio.Score,
    public soundfont2: Soundfont2
  ) {
    this.audioContext = new AudioContext();
    this.masterGain = this.audioContext.createGain();
    score.onChangeGain = (value: number) =>
      (this.masterGain.gain.value = value);
    this.masterGain.connect(this.audioContext.destination);
    for (const track of this.score.tracks) {
      const trackGain = this.audioContext.createGain();
      trackGain.connect(this.masterGain);
      track.onChangeGain = (value: number) => (trackGain.gain.value = value);
      const preset = this.soundfont2.getPreset(track.preset.value);
      for (const note of track.notes) {
        const synth = new BrowserAudio.Synth({
          pitch: note.soundingPitch,
          preset,
          audioContext: this.audioContext,
        });
        synth.onNoteOn = note.onNoteOn;
        synth.onNoteOff = note.onNoteOff;
        synth.gain.connect(trackGain);
        this.notes.push({ note, synth });
      }
    }
  }
  play() {
    this.startTime = this.audioContext.currentTime;
    if (this.isPaused) {
      this.isPaused = false;
      this.audioContext.resume();
    } else {
      for (const { note, synth } of this.notes) {
        synth.noteOn(
          this.startTime + note.start.toSeconds(note.tempo.value),
          note.isLast
            ? () => {
                this.onPlayEnd?.();
              }
            : undefined
        );
        synth.noteOff(this.startTime + note.end.toSeconds(note.tempo.value));
      }
    }
  }
  pause() {
    this.isPaused = true;
    this.audioContext.suspend();
  }
  stop() {
    for (const { synth } of this.notes) synth.bufferSource?.stop();
  }
}
