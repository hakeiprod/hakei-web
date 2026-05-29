import { prop } from "remeda";
import { MusicData } from "./music-data";
import { Part } from "./part";

export class Key {
  get start() {
    return this.musicData.start;
  }
  get duration() {
    return this.end - this.start;
  }
  get end() {
    return (
      this.part.keys[this.part.keys.indexOf(this) + 1]?.start ??
      this.part.scorePartwise.end ??
      0
    );
  }
  get fifths() {
    return prop(this.musicData, "data", "key", 0, "fifths", 0, "_") ?? 0;
  }
  get mode() {
    return prop(this.musicData, "data", "key", 0, "mode", 0, "_") ?? 0;
  }
  constructor(
    public musicData: MusicData,
    public part: Part,
  ) {}
}
