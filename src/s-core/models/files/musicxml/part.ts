import { firstBy, isDefined, prop } from "remeda";
import { Key } from "./key";
import { Measure } from "./measure";
import { ScorePartwise } from "./score-partwise";
import { Tempo } from "./tempo";
import { Time } from "./time";

export class Part {
  measures;
  times;
  keys;
  tempos;
  get scorePart() {
    return this.scorePartwise.scorePart?.find(
      (scorePart) => scorePart.data.$?.id === this.data.$?.id,
    );
  }
  get musicDatas() {
    return this.measures.flatMap(prop("musicDatas"));
  }
  get notes() {
    return this.measures.flatMap(prop("notes"));
  }
  get start() {
    return firstBy(this.measures, prop("start"))?.start ?? 0;
  }
  get end() {
    return firstBy(this.measures, [prop("end"), "desc"])?.end ?? 0;
  }
  constructor(
    public data: NonNullable<ScorePartwise["data"]["part"]>[number],
    public scorePartwise: ScorePartwise,
  ) {
    this.measures =
      this.data.measure?.map((measure) => new Measure(measure, this)) ?? [];
    this.times = this.musicDatas
      .filter((musicData) => isDefined(prop(musicData, "data", "time")))
      .map((current) => new Time(current!, this));
    this.keys = this.musicDatas
      .filter((musicData) => isDefined(prop(musicData, "data", "key")))
      .map((current) => new Key(current!, this));
    this.tempos = this.musicDatas
      .filter((musicData) => isDefined(prop(musicData, "data", "sound")))
      .map((current) => new Tempo(current!, this));
  }
}
