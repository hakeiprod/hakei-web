import * as Sheet from "..";
import * as SMUFL from "../../smufl";

declare module ".." {
  interface Score {
    toSMUFL: () => SMUFL.Score;
  }
}

Sheet.Score.prototype.toSMUFL = function (this: Sheet.Score) {
  return SMUFL.Score.create({
    ...this.params,
    tracks: this.tracks.map((track) => ({
      ...track.params,
      notes: track.notes.map((note) => note.params),
    })),
    chords: this.chords.map(({ params }) => params),
    bars: this.bars.map(({ params }) => params),
    staves: this.staves.map(({ params }) => params),
    keysignatures: this.keysignatures.map(({ params }) => params),
    timesignatures: this.timesignatures.map(({ params }) => params),
    tempos: this.tempos.map(({ params }) => params),
  });
};
