import { measure } from "./layout-pass";
import { firstBy, identity, map, pipe, piped, prop } from "remeda";
import * as Sheet from ".";

export class Bar {
  readonly id;
  trackId;
  score!: Sheet.Score;
  get timesignature() {
    return this.score.timesignatures.find((timesignature) =>
      timesignature.isOverlapped(this.masterbar),
    )!;
  }
  get keysignature() {
    return this.score.keysignatures.find((keysignature) =>
      keysignature.isOverlapped(this.masterbar),
    )!;
  }
  get track() {
    if (this.score.layoutIndex)
      return this.score.layoutIndex.trackById.get(this.trackId)!;
    return this.score.tracks.find((track) => track.id === this.trackId)!;
  }
  get masterbar() {
    if (this.score.layoutIndex)
      return this.score.layoutIndex.masterbarById.get(this.id)!;
    return this.score.masterbars.find((masterbar) => masterbar.id === this.id)!;
  }
  get notes() {
    if (this.score.layoutIndex)
      return [...(this.score.layoutIndex.barNotes.get(this) ?? [])];
    return this.masterbar.notes.filter((note) => note.trackId === this.trackId);
  }
  get chords() {
    if (this.score.layoutIndex)
      return [...(this.score.layoutIndex.barChords.get(this) ?? [])];
    return this.masterbar.chords.filter(
      (chord) => chord.track.id === this.trackId,
    );
  }
  get events() {
    return this.masterbar.events.filter(
      (event) => event.track.id === this.trackId,
    );
  }
  get staves() {
    if (this.score.layoutIndex)
      return [...(this.score.layoutIndex.barStaves.get(this) ?? [])];
    return this.score.staves.filter(
      (stave) => stave.barId === this.id && stave.trackId === this.trackId,
    );
  }
  get width() {
    return measure(this.score.layoutPass, this, "sheet/bar.ts:width", () => {
      return (
        pipe(
          this.staves,
          map(piped(prop("width"))),
          firstBy([identity(), "desc"]),
        ) ?? 0
      );
    });
  }
  get minWidth() {
    return measure(this.score.layoutPass, this, "sheet/bar.ts:minWidth", () => {
      return (
        pipe(
          this.staves,
          map(piped(prop("minWidth"))),
          firstBy([identity(), "desc"]),
        ) ?? 0
      );
    });
  }
  get height() {
    return measure(this.score.layoutPass, this, "sheet/bar.ts:height", () => {
      return (
        this.staves.reduce(
          (accumulator, current) => accumulator + current.height,
          0,
        ) +
        (this.staves.length - 1) * 6.5
      );
    });
  }
  get prev() {
    return this.track.bars[this.id - 1];
  }
  constructor({ id, trackId }: { id: number; trackId: number }) {
    this.id = id;
    this.trackId = trackId;
  }
  serialize() {
    return { id: this.id, trackId: this.trackId };
  }
  export() {
    return this.serialize();
  }
  static import(data: ReturnType<Bar["export"]>) {
    return new Bar(data);
  }
}
