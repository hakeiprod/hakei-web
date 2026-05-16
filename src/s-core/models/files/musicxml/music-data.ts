import { filter, isDefined, last, pipe, prop } from "remeda";
import { Measure } from "./measure";

export class MusicData {
  get start(): number {
    return (
      this.measure.part.musicDatas[
        this.measure.part.musicDatas.indexOf(this) - 1
      ]?.end ?? 0
    );
  }
  get end() {
    return this.start + this.duration;
  }
  get duration() {
    const duration = (prop(this.data, "duration", 0, "_") as number) ?? 0;
    if (duration === 0 || this.division === 0) return 0;
    return duration / this.division;
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
      ) as number) ?? 0
    );
  }
  constructor(
    public data: NonNullable<Measure["data"]["$$"]>[0],
    public measure: Measure,
  ) {}
}
