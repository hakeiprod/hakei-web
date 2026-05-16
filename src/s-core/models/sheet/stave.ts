import { match, P } from "ts-pattern";
import * as Sheet from ".";
import { Clef } from "../../const/musicxml/4.0/musicxml";
import * as Core from "../core";

export class Stave {
  readonly id;
  barId;
  trackId;
  clefs;
  word = new Sheet.Word();
  score!: Sheet.Score;
  get bar() {
    return this.score.bars.find(
      (bar) => bar.trackId === this.trackId && bar.id === this.barId,
    )!;
  }
  get notes() {
    return this.bar.notes.filter((note) => note.staveId === this.id);
  }
  get slots() {
    return this.score.slots.filter((slot) =>
      this.bar.masterbar.isOverlapped(slot),
    );
  }
  get beamGroups() {
    return this.score.beamGroups.filter(
      (beam) =>
        beam.staveId === this.id &&
        beam.stave.trackId === this.trackId &&
        beam.stave.barId === this.barId,
    );
  }
  get chords() {
    return this.bar.chords.filter((chord) => chord.staveId === this.id);
  }
  get events() {
    return this.bar.events.filter((event) => event.staveId === this.id);
  }
  get height() {
    return -1;
  }
  get width() {
    return (
      this.slots.reduce(
        (accumulator, current) => accumulator + current.width,
        0,
      ) + this.word.width
    );
  }
  get y() {
    return this.id * this.height + this.id * 6.5;
  }
  get prev() {
    return this.bar.prev?.staves[this.id];
  }
  constructor({
    id,
    barId,
    trackId,
    clefs: clef,
  }: {
    id: number;
    barId: number;
    trackId: number;
    clefs?: Clef[];
  }) {
    this.id = id;
    this.barId = barId;
    this.trackId = trackId;
    this.clefs = clef;
  }
  serialize() {
    return {
      id: this.id,
      trackId: this.trackId,
      barId: this.barId,
      clefs: this.clefs,
    };
  }
  export() {
    return this.serialize();
  }
  static import(data: ReturnType<Stave["export"]>) {
    return new Stave(data);
  }
  draw() {
    if (this.bar.masterbar.isRowFirst)
      this.word.append([
        new Sheet.Glyph(
          Sheet.ElementType.Clef,
          this.resolveClefs()[0]?.line?.[0]?._ ?? 0,
        ),
      ]);
    if (this.bar.masterbar.isFirst) {
      const keysignatureLigature = new Sheet.Ligature(
        (this.bar.keysignature.ligature.line = match(
          this.resolveClefs()[0]?.sign![0]._,
        )
          .with("G", () => 0.5)
          .with("F", () => -0.5)
          .with(P.union("C", "TAB", "jianpu", "none", "percussion"), () => {
            throw new Error("wip");
          })
          .exhaustive()),
      );
      keysignatureLigature.glyphLists =
        this.bar.keysignature.ligature.glyphLists;
      this.word.append(
        [keysignatureLigature],
        [this.bar.timesignature.ligature],
      );
    }
  }
  resolveClefs(): Clef[] {
    return this.clefs ?? this.prev!.resolveClefs();
  }
  getClefScientificPitchNotation() {
    return new Core.Units.ScientificPitchNotation(
      match(this.resolveClefs()[0]?.sign![0]._)
        .with("G", (value) => `${value}4`)
        .with("F", (value) => `${value}3`)
        .with(P.union("C", "TAB", "jianpu", "none", "percussion"), () => {
          throw new Error("wip");
        })
        .exhaustive(),
    );
  }
}
