import { prop } from "remeda";
import { MusicData } from "./music-data";
import { Part } from "./part";

export class Time {
  get start() {
    return this.musicData.start;
  }
  get duration() {
    return this.end - this.start;
  }
  get end() {
    return (
      this.part.times[this.part.times.indexOf(this) + 1]?.start ?? this.part.end
    );
  }
  get numerator() {
    return Number(prop(this.musicData, "data", "time", 0, "beats", 0, "_"));
  }
  get denominator() {
    return Number(prop(this.musicData, "data", "time", 0, "beat-type", 0, "_"));
  }
  constructor(
    public musicData: MusicData,
    public part: Part,
  ) {}
}
