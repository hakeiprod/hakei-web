import { Seconds } from "@/s-core/models/files/soundfont2/units/seconds";

export {};
declare global {
  interface AudioContext {
    getCurrentSeconds: () => Seconds;
  }
}
AudioContext.prototype.getCurrentSeconds = function () {
  return new Seconds(this.currentTime);
};
