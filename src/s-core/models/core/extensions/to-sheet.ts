import * as Sheet from "../../sheet";
import * as Core from "../../core";
import { match } from "ts-pattern";
import { entries, groupByProp, last, map, only, pipe, piped } from "remeda";

declare module "../../core" {
  interface Score {
    toSheet(): Sheet.Score;
  }
}

Core.Score.prototype.toSheet = function (this: Core.Score) {
  return Sheet.Score.create(
    {
      ...this.params,
      tracks: this.tracks.map((track) => ({
        ...track.params,
        staffDetails: { $$: { "staff-lines": [{ _: 5 }] } },
        notes: pipe(
          track.notes,
          map((note) => ({
            ...note.params,
            pitch: note.pitch.value,
            stem: { _: "up" as const },
            voice: 1,
            staveId: match(track.preset.toName())
              .with("Acoustic Grand Piano", () =>
                note.pitch.value < Core.Units.MidiNoteNumber.MIDDLE_C ? 1 : 0
              )
              .otherwise(() => 0),
          })),
          groupByProp("start"),
          entries(),
          map(piped(last(), (last) => only(last) ?? last))
        ),
      })),
      keysignatures: this.keysignatures.map(({ params }) => params),
      timesignatures: this.timesignatures.map(({ params }) => params),
      tempos: this.tempos.map(({ params }) => params),
    },
    {}
  );
};
