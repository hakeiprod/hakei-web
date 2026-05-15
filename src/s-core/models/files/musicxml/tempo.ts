import { prop } from "remeda";
import { MusicData } from "./music-data";
import { Part } from "./part";

export class Tempo {
  get start() {
    return this.musicData.start;
  }
  get duration() {
    return this.end - this.start;
  }
  get end() {
    return (
      this.part.tempos[this.part.tempos.indexOf(this) + 1]?.start ??
      this.part.end
    );
  }
  get tempo() {
    return prop(this.musicData, "data", "sound", 0, "$", "tempo");
  }
  constructor(
    public musicData: MusicData,
    public part: Part,
  ) {}
}
