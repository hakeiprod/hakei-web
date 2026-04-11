import { isNonNullish, isNullish } from "remeda";
import { Seconds } from "../../files/soundfont2/units/seconds";

export class Timer {
  startSeconds?: Seconds;
  pauseSeconds?: Seconds | null;
  totalPausedSeconds = new Seconds(0);
  get elapsedSeconds() {
    if (isNullish(this.startSeconds)) return new Seconds(0);
    if (isNonNullish(this.pauseSeconds))
      return this.pauseSeconds
        .subtract(this.startSeconds)
        .subtract(this.totalPausedSeconds);
    return this.audioContext
      .getCurrentSeconds()
      .subtract(this.startSeconds)
      .subtract(this.totalPausedSeconds);
  }
  constructor(public audioContext: AudioContext) {}
  play() {
    this.startSeconds = this.audioContext.getCurrentSeconds();
  }
  pause() {
    this.pauseSeconds = this.audioContext.getCurrentSeconds();
  }
  resume() {
    if (isNonNullish(this.pauseSeconds))
      this.totalPausedSeconds.add(
        this.audioContext.getCurrentSeconds().subtract(this.pauseSeconds),
      );
    this.pauseSeconds = null;
  }
  stop() {}
}
