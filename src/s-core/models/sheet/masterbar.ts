import { firstBy, identity, map, pipe, prop } from "remeda";
import * as Sheet from ".";
import { Barline } from "../../const/musicxml/4.0/musicxml";
import * as Core from "../core";

export class Masterbar extends Core.Event {
  readonly id;
  rowId;
  barline;
  score!: Sheet.Score;
  get x(): number {
    return (
      this.row.masterbars[this.row.masterbars.indexOf(this) - 1]?.right ?? 0
    );
  }
  get y(): number {
    return this.row.y;
  }
  get right() {
    return this.x + this.width;
  }
  get width() {
    return (
      pipe(this.bars, map(prop("width")), firstBy([identity(), "desc"])) ?? 0
    );
  }
  get minWidth() {
    return (
      pipe(this.bars, map(prop("minWidth")), firstBy([identity(), "desc"])) ?? 0
    );
  }
  get height() {
    return (
      this.bars.reduce(
        (accumulator, current) => accumulator + current.height,
        0,
      ) +
      (this.bars.length - 1) * 13
    );
  }
  get isRowFirst() {
    return this.row.masterbars[0]?.id === this.id;
  }
  get isRowLast() {
    return this.row.masterbars.at(-1)?.id === this.id;
  }
  get isFirst() {
    return this.score.masterbars[0]?.id === this.id;
  }
  get isLast() {
    return this.score.masterbars.at(-1)?.id === this.id;
  }
  get row() {
    return this.score.rows.find((row) => row.id === this.rowId)!;
  }
  get slots() {
    return this.score.slots.filter((slot) => slot.isOverlapped(this));
  }
  get bars() {
    return this.score.bars.filter((bar) => bar.id === this.id);
  }
  get notes() {
    return this.score.notes.filter((note) => note.isOverlapped(this));
  }
  get chords() {
    return this.score.chords.filter((chord) => chord.isOverlapped(this));
  }
  get events() {
    return this.score.events.filter((event) => event.isOverlapped(this));
  }
  constructor(
    masterbar: {
      id: number;
      rowId?: number;
      barline: Barline;
    } & ConstructorParameters<typeof Core.Event>[0],
  ) {
    const { id, rowId, barline } = masterbar;
    super(masterbar);
    this.id = id;
    this.rowId = rowId;
    this.barline = barline;
  }
  serialize() {
    return {
      ...super.serialize(),
      id: this.id,
      barline: this.barline,
    };
  }
  export() {
    return this.serialize();
  }
  static import(data: ReturnType<Masterbar["export"]>) {
    return new Masterbar({
      ...data,
      start: new Core.Units.Beat(data.start),
      duration: new Core.Units.Beat(data.duration),
      end: new Core.Units.Beat(data.end),
    });
  }
}
