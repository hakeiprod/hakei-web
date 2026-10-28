import { firstBy, identity, map, pipe, prop } from "remeda";
import * as Sheet from ".";
export const rowSpacing = 10;

export class Row {
  readonly id;
  notationTop = 0;
  notationBottom = 0;
  score!: Sheet.Score;
  get width() {
    return this.masterbars.reduce(
      (accumulator, current) => accumulator + current.width,
      0,
    );
  }
  get minWidth() {
    return this.masterbars.reduce(
      (accumulator, current) => accumulator + current.minWidth,
      0,
    );
  }
  get height() {
    return (
      (pipe(
        this.masterbars,
        map(prop("height")),
        firstBy([identity(), "desc"]),
      ) ?? 0) +
      this.notationTop +
      this.notationBottom
    );
  }
  get y(): number {
    return this.prev ? this.prev.y + this.prev.height + rowSpacing : 0;
  }
  get masterbars(): Sheet.Masterbar[] {
    if (this.score.layoutPass)
      return [
        ...this.score.layoutPass.relation(this, "row-masterbars", () =>
          this.score.masterbars.filter(
            (masterbar) => masterbar.rowId === this.id,
          ),
        ),
      ];
    return this.score.masterbars.filter(
      (masterbar) => masterbar.rowId === this.id,
    );
  }
  get prev() {
    return this.score.rows[this.id - 1];
  }

  constructor({ id }: { id: number }) {
    this.id = id;
  }
}
