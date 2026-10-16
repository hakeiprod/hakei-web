import { Seconds } from "@/s-core/models/files/soundfont2/units/seconds";

export {};
declare global {
  interface AudioContext {
    getCurrentSeconds: () => Seconds;
  }
}
if (typeof AudioContext !== "undefined") {
  AudioContext.prototype.getCurrentSeconds = function () {
    return new Seconds(this.currentTime);
  };
}
