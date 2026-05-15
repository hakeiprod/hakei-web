import { filter, firstBy, map, pipe, prop } from "remeda";
import { MusicData } from "./music-data";
import { Note } from "./note";
import { Part } from "./part";

export class Measure {
  notes;
  musicDatas?: MusicData[];
  get start() {
    return (
      firstBy(this.notes, prop("musicData", "start"))?.musicData.start ?? 0
    );
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
    this.musicDatas = data.$$?.reduce(
      (accumulator, current) => {
        accumulator.musicDatas.push(
          new MusicData(
            current,
            this,
            accumulator.prev?.end,
            prop(current, "duration", 0, "_") as number,
          ),
        );
        accumulator.prev = accumulator.musicDatas.at(-1)!;
        return accumulator;
      },
      {
        musicDatas: [],
        prev: null,
      } as {
        musicDatas: MusicData[];
        prev: MusicData | null;
      },
    ).musicDatas;
    this.notes = pipe(
      this.musicDatas ?? [],
      filter((musicData) => musicData.data["#name"] === "note"),
      map((musicData) => new Note(musicData, this)),
    );
  }
}
