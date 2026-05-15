import { isDefined, prop } from "remeda";
import { Measure } from "./measure";

export class MusicData {
  get end() {
    return this.start + (this.duration ?? 0);
  }
  get duration() {
    if (!this.division) return;
    if (this._duration == null) return;
    return this._duration / this.division;
  }
  get division() {
    return (
      (prop(
        this.measure.part.data.measure
          ?.slice(0, this.measure.part.data.measure.indexOf(this.measure.data))
          .findLast((measure) =>
            isDefined(prop(measure, "attributes", 0, "divisions")),
          ),
        "attributes",
        0,
        "divisions",
        0,
        "_",
      ) as number) ?? 0
    );
  }
  constructor(
    public data: NonNullable<Measure["data"]["$$"]>[0],
    public measure: Measure,
    public start: number = 0,
    public _duration: number = 0,
  ) {}
}
