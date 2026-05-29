import { isDefined, prop } from "remeda";
import * as Core from "../../core";
import { Measure } from "./measure";
import { MusicData } from "./music-data";

export class Note {
  chordId: number | undefined;
  get staff() {
    return prop(this.musicData, "data", "staff", 0, "_") ?? 1;
  }
  get chord() {
    return isDefined(prop(this.musicData, "data", "chord"));
  }
  get rest() {
    return isDefined(prop(this.musicData, "data", "rest"));
  }
  get pitch() {
    return new Core.Units.ScientificPitchNotation(
      `${prop(this.musicData, "data", "pitch", 0, "step", 0, "_") ?? "C"}${
        prop(this.musicData, "data", "pitch", 0, "octave", 0, "_") ?? 0
      }`,
    );
  }
  get velocity() {
    return 102;
  }
  get voice() {
    return Number(prop(this.musicData, "data", "voice", "0", "_") ?? 1);
  }
  get prev() {
    return this.measure.notes[this.measure.notes.indexOf(this) - 1];
  }
  get next() {
    return this.measure.notes[this.measure.notes.indexOf(this) + 1];
  }
  constructor(
    public musicData: MusicData,
    public measure: Measure,
  ) {}
}
