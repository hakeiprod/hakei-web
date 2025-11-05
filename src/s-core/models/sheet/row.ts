import { firstBy, identity, map, pipe, prop } from "remeda";
import * as Sheet from ".";

const paddingBottom = 4;
export class Row {
  readonly id;
  score!: Sheet.Score;
  get width() {
    return this.masterbars.reduce(
      (accumulator, current) => accumulator + current.width,
      0
    );
  }
  get minWidth() {
    return this.masterbars.reduce(
      (accumulator, current) => accumulator + current.minWidth,
      0
    );
  }
  get height() {
    return (
      (pipe(
        this.masterbars,
        map(prop("height")),
        firstBy([identity(), "desc"])
      ) ?? 0) + paddingBottom
    );
  }
  get y(): number {
    return this.prev ? this.prev.y + this.height : 0;
  }
  get masterbars() {
    return this.score.masterbars.filter(
      (masterbar) => masterbar.rowId === this.id
    );
  }
  get prev() {
    return this.score.rows[this.id - 1];
  }

  constructor({ id }: { id: number }) {
    this.id = id;
  }
}
