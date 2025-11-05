import { match } from "ts-pattern";
import { LayoutType, Score } from "./";
import { Row } from "./row";
import {
  entries,
  flatMap,
  groupBy,
  pipe,
  length,
  prop,
  reduce,
  forEach,
  firstBy,
  piped,
  defaultTo,
} from "remeda";

export class Controller {
  constructor(
    public score: Score,
    public layoutType: LayoutType,
    public scale: number
  ) {
    this.layoutType = layoutType;
    this.layout(layoutType);
  }
  layout(layoutType: LayoutType) {
    match(layoutType)
      .with(LayoutType.Page as 2, () => {})
      .with(LayoutType.Horizontal as 0, () => {
        for (const masterbar of this.score.masterbars) masterbar.rowId = 0;
        this.score.rows = [new Row({ id: 0 })];
      })
      .with(LayoutType.Vertical as 1, () => {
        this.score.rows = splitByWidth(
          this.score.masterbars,
          window.innerWidth / this.scale,
          (mb) => mb.minWidth
        ).map((masterbars, id) => {
          for (const masterbar of masterbars) masterbar.rowId = id;
          return new Row({ id });
        });
      })
      .exhaustive();
    for (const row of this.score.rows) row.score = this.score;
    this.draw();
    this.space(window.innerWidth, window.innerHeight);
    this.order();
    this.align();
  }
  draw() {
    for (const data of [
      ...this.score.notes,
      ...this.score.chords,
      ...this.score.staves,
      ...this.score.timesignatures,
    ])
      data.draw();
  }
  order() {
    this.score.staves.flatMap((stave) => stave.ligature?.order());
  }
  space(width: number, height: number) {
    for (const row of this.score.rows) {
      const groupedByStartEvents = pipe(
        row,
        prop("masterbars"),
        flatMap(prop("events")),
        groupBy(prop("start", "value")),
        entries()
      );
      match(this.layoutType)
        .with(LayoutType.Page as 2, () => {
          console.log(height);
        })
        .with(LayoutType.Horizontal as 0, () => {
          for (const [, events] of groupedByStartEvents)
            for (const event of events)
              if (event.ligature) event.ligature.inset.right = 2; // FIXME: const
        })
        .with(LayoutType.Vertical as 1, () => {
          const space =
            (width / this.scale - row.minWidth) /
            pipe(groupedByStartEvents, length());
          for (const [, events] of groupedByStartEvents)
            for (const event of events)
              if (event.ligature) event.ligature.inset.right = space;
        })
        .exhaustive();
    }
  }
  align() {
    pipe(
      this.score.events,
      groupBy(prop("start", "value")),
      entries(),
      forEach(([, notes]) => {
        const maxXNote = firstBy(notes, [
          piped(prop("ligature", "boundingBox", "x"), defaultTo(0)),
          "desc",
        ]);
        for (const note of notes) {
          if (note === maxXNote) continue;
          if (note.ligature)
            note.ligature.boundingBox.x = maxXNote.ligature?.boundingBox.x ?? 0;
        }
      })
    );
  }
}

function splitByWidth<T>(
  items: T[],
  width: number,
  selector: (item: T) => number
): T[][] {
  return pipe(
    items,
    reduce(
      (accumulator, item) => {
        const current = accumulator.at(-1);
        const currentSum =
          current?.reduce((sum, element) => sum + selector(element), 0) ?? 0;
        const itemWeight = selector(item);
        if (currentSum + itemWeight > width) {
          accumulator.push([item]);
        } else {
          current?.push(item);
        }
        return accumulator;
      },
      [[]] as T[][]
    )
  );
}
