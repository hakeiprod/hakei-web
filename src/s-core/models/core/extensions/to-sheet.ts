import {
  entries,
  flatMap,
  groupByProp,
  last,
  map,
  only,
  pipe,
  piped,
} from "remeda";
import { match } from "ts-pattern";
import * as Core from "../../core";
import * as Sheet from "../../sheet";

declare module "../../core" {
  interface Score {
    toSheet(): Sheet.Score;
  }
}

Core.Score.prototype.toSheet = function (this: Core.Score) {
  return Sheet.Score.import({
    ...this.export(),
    tracks: this.tracks.map((track) => ({
      ...track.export(),
      staffDetails: { $$: { "staff-lines": [{ _: 5 }] } },
    })),
    notes: pipe(
      this.notes,
      map((note) => ({
        ...note.export(),
        stem: undefined,
        voice: 1,
        chordId: undefined,
        rest: false,
        beam: undefined,
        flag: null,
        alter: undefined,
        staveId: match(note.track.preset.toName())
          .with("Acoustic Grand Piano", () =>
            note.pitch.value < Core.Units.MidiNoteNumber.MIDDLE_C ? 1 : 0
          )
          .otherwise(() => 0),
      })),
      groupByProp("start"),
      entries(),
      flatMap(piped(last(), (last) => only(last) ?? last))
    ),
    bars: [],
    staves: [],
    masterbars: [],
    chords: [],
    rows: [],
  });
};
