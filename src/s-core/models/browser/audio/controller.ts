import * as BrowserAudio from ".";

export class Controller {
  score;
  isPlaying = false;
  constructor(score: BrowserAudio.Score) {
    this.score = score;
  }
  play(startTime: number) {
    for (const note of this.score.notes) {
      note.synth.noteOn(startTime + note.start.toSeconds(note.tempo.value));
      note.synth.noteOff(startTime + note.end.toSeconds(note.tempo.value));
    }
  }
  pause() {}
  stop() {}
}
