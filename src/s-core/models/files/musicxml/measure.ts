import { filter, map, pipe, prop } from "remeda";
import { MusicData } from "./music-data";
import { Note } from "./note";
import { Part } from "./part";

export class Measure {
  notes;
  musicDatas?: MusicData[];
  private startPosition = 0;
  private nominalMeasureDuration?: number;
  get staveCount() {
    return (
      prop(
        this.musicDatas?.find(
          (musicData) => musicData.data["#name"] === "attributes",
        ),
        "data",
        "staves",
        0,
        "_",
      ) ?? 1
    );
  }
  get start() {
    return this.startPosition;
  }
  setTimeline(start: number, nominalDuration?: number) {
    this.startPosition = start;
    this.nominalMeasureDuration = nominalDuration;
  }
  get declaredNominalDuration(): number | undefined {
    for (const musicData of this.musicDatas ?? []) {
      const times = prop(musicData, "data", "time") as
        | Array<{
            beats?: Array<{ _: string | number }>;
            "beat-type"?: Array<{ _: string | number }>;
          }>
        | undefined;
      const time = times?.[0];
      if (!time) continue;
      const beats = time.beats ?? [];
      const beatTypes = time["beat-type"] ?? [];
      const timeDuration = beats.reduce((total, beat, index) => {
        const beatType = Number(beatTypes[index]?._);
        if (!beatType) return total;
        const numerator = String(beat._)
          .split("+")
          .reduce((sum, value) => sum + Number(value), 0);
        return total + (numerator * 4) / beatType;
      }, 0);
      if (timeDuration > 0) return timeDuration;
    }
    return undefined;
  }
  get duration() {
    const contentDuration = Math.max(
      0,
      ...(this.musicDatas ?? []).map(
        (musicData) => musicData.end - this.start,
      ),
    );
    if (this.data.$?.implicit === "yes") return contentDuration;
    return Math.max(contentDuration, this.nominalMeasureDuration ?? 0);
  }
  get end() {
    return this.start + this.duration;
  }
  constructor(
    public data: NonNullable<Part["data"]["measure"]>[number],
    public part: Part,
  ) {
    this.musicDatas = data.$$?.map((current) => new MusicData(current, this));
    this.notes = pipe(
      this.musicDatas ?? [],
      filter((musicData) => musicData.data["#name"] === "note"),
      map((musicData) => new Note(musicData, this)),
    );
  }
}
