import { filter, firstBy, map, pipe, prop } from "remeda";
import { MusicData } from "./music-data";
import { Note } from "./note";
import { Part } from "./part";

export class Measure {
  notes;
  musicDatas?: MusicData[];
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
    return (
      firstBy(this.notes, prop("musicData", "start"))?.musicData.start ?? 0
    );
  }
  get duration() {
    return this.end - this.start;
  }
  get end() {
    return (
      firstBy(this.notes, [prop("musicData", "end"), "desc"])?.musicData.end ??
      0
    );
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
