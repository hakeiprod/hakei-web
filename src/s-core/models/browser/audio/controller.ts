import * as Audio from "../../audio";
import * as BrowserAudio from ".";
import Soundfont2 from "../../files/soundfont2";

export class Controller {
  masterGain;
  isPlaying = false;
  notes: { note: Audio.Note; synth: BrowserAudio.Synth }[] = [];
  constructor(
    public score: Audio.Score,
    public audioContext: AudioContext,
    public soundfont2: Soundfont2
  ) {
    this.masterGain = audioContext.createGain();
    score.onChangeGain = (value: number) =>
      (this.masterGain.gain.value = value);
    this.masterGain.connect(audioContext.destination);
    for (const track of this.score.tracks) {
      const trackGain = audioContext.createGain();
      trackGain.connect(this.masterGain);
      track.onChangeGain = (value: number) => (trackGain.gain.value = value);
      const preset = this.soundfont2.getPreset(track.preset.value);
      for (const note of track.notes) {
        const synth = new BrowserAudio.Synth({
          pitch: note.soundingPitch,
          preset,
          audioContext,
        });
        synth.onNoteOn = note.onNoteOn;
        synth.onNoteOff = note.onNoteOff;
        synth.gain.connect(trackGain);
        this.notes.push({ note, synth });
      }
    }
  }
  play(startTime: number) {
    for (const { note, synth } of this.notes) {
      synth.noteOn(startTime + note.start.toSeconds(note.tempo.value));
      synth.noteOff(startTime + note.end.toSeconds(note.tempo.value));
    }
  }
  pause() {}
  stop() {}
}
