import { filter, isDefined, last, pipe, prop } from "remeda";
import { Measure } from "./measure";

export class MusicData {
  get start(): number {
    const musicDatas = this.measure.musicDatas ?? [];
    const previousMusicData = musicDatas[musicDatas.indexOf(this) - 1];
    if (prop(this.data, "chord"))
      return previousMusicData?.start ?? this.measure.start;
    return previousMusicData?.end ?? this.measure.start;
  }
  get end() {
    return this.start + this.duration;
  }
  get duration() {
    const duration =
      ((prop(this.data, "duration", 0, "_") as number) ?? 0) / this.division;
    if (this.data["#name"] === "backup") return -duration;
    return duration;
  }
  get division() {
    return (
      (prop(
        pipe(
          this.measure.part.musicDatas.slice(
            0,
            this.measure.part.musicDatas.indexOf(this),
          ),
          filter((musicData) =>
            isDefined(prop(musicData, "data", "divisions")),
          ),
          last(),
        ),
        "data",
        "divisions",
        0,
        "_",
      ) as number) ?? 1
    );
  }
  constructor(
    public data: NonNullable<Measure["data"]["$$"]>[0],
    public measure: Measure,
  ) {}
}
