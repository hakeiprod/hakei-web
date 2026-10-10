import { entries, flatMap, groupBy, length, pipe, prop } from "remeda";
import { match } from "ts-pattern";
import { LayoutType, Ligature, Score, Word } from "./";
import { Row } from "./row";
import type { PageLayout } from "./page";

type Debug =
  | boolean
  | {
      enabled: boolean;
      showBoundingBox:
        | boolean
        | {
            slot?: boolean;
            masterbar?: boolean;
          };
    };

export class Controller {
  onChangeScale?: (scale: typeof this.options.scale) => void;
  onChangeLayoutType?: (scale: typeof this.options.layoutType) => void;
  onChangeDebug?: (debug: typeof this.options.debug) => void;
  onChangeAdvanced?: (advanced: typeof this.options.advanced) => void;
  constructor(
    public score: Score,
    public options: {
      scale: number;
      layoutType: LayoutType;
      advanced: boolean;
      debug: Debug;
      /** Available display width in pixels for vertical scrolling. */
      viewportWidth?: number;
      /** Available display height in pixels for page navigation. */
      viewportHeight?: number;
      pageLayout?: PageLayout;
    },
  ) {}
  mount() {
    // Layout uses chord widths, which in turn use note glyph widths. Initialize
    // those drawing objects before calculating the layout.
    for (const note of this.score.notes) note.draw();
    for (const chord of this.score.chords) chord.draw();
    this.setRows();
    this.draw();
    this.layout();
  }
  unmount() {
    for (const data of [
      // ...this.score.notes,
      ...this.score.timesignatures,
      ...this.score.keysignatures,
    ])
      data.ligature = new Ligature();
    for (const data of this.score.chords)
      data.noteheadsLigature = new Ligature();
    for (const data of [...this.score.chords, ...this.score.staves])
      data.word = new Word();
  }
  private setRows() {
    for (const masterbar of this.score.masterbars) masterbar.rowId = 0;
    const row = new Row({ id: 0 });
    row.score = this.score;
    this.score.rows = [row];
  }
  get pageLayout(): PageLayout {
    if (this.options.pageLayout) return this.options.pageLayout;
    const width =
      (this.options.viewportWidth ?? globalThis.window?.innerWidth ?? 1024) /
      this.options.scale;
    const height =
      (this.options.viewportHeight ?? globalThis.window?.innerHeight ?? 768) /
      this.options.scale;
    return { width, height, margin: Math.min(4, width / 4, height / 4) };
  }
  get layoutWidth() {
    if (this.options.layoutType === LayoutType.Page) {
      const page = this.pageLayout;
      return page.width - page.margin * 2;
    }
    return (
      (this.options.viewportWidth ?? globalThis.window?.innerWidth ?? 1024) /
      this.options.scale
    );
  }
  layout() {
    this.setRows();
    let row = this.score.rows[0];
    let width = 0;
    for (const masterbar of this.score.masterbars) {
      masterbar.rowId = row.id;
      const drawStaves = () => {
        for (const bar of masterbar.bars)
          for (const stave of bar.staves) {
            stave.word = new Word();
            stave.draw();
          }
      };
      drawStaves();
      if (
        this.options.layoutType !== LayoutType.Horizontal &&
        width > 0 &&
        width + masterbar.minWidth > this.layoutWidth
      ) {
        row = new Row({ id: this.score.rows.length });
        row.score = this.score;
        this.score.rows.push(row);
        masterbar.rowId = row.id;
        // A new system repeats its clef; include that width when wrapping.
        drawStaves();
        width = 0;
      }
      width += masterbar.minWidth;
    }
  }
  draw() {
    for (const data of [
      ...this.score.notes,
      ...this.score.chords,
      ...this.score.timesignatures,
      ...this.score.keysignatures,
      ...this.score.staves,
    ])
      data.draw();
  }
  order() {
    this.score.staves.map((stave) => stave.word?.order());
    this.score.chords.map((chord) => chord.word.order());
  }
  space(width: number) {
    for (const row of this.score.rows) {
      const groupedByStartEvents = pipe(
        row,
        prop("masterbars"),
        flatMap(prop("events")),
        groupBy(prop("start", "value")),
        entries(),
      );
      match(this.options.layoutType)
        .with(LayoutType.Page as 2, () => {})
        .with(LayoutType.Horizontal as 0, () => {
          for (const [, events] of groupedByStartEvents)
            for (const event of events) {
            }
          // if (event.ligature) {
          // event.ligature.edge.right =
          //   Metadata.defaultValue.spacing.note.right;
          // event.ligature.edge.left =
          //   Metadata.defaultValue.spacing.note.left;
          // }
        })
        .with(LayoutType.Vertical as 1, () => {
          const space =
            (width / this.options.scale - row.minWidth) /
            pipe(groupedByStartEvents, length());
          for (const [, events] of groupedByStartEvents)
            for (const event of events) {
            }
          // if (event.ligature) event.ligature.right = space;
        })
        .exhaustive();
    }
  }
  setScale(scale: typeof this.options.scale) {
    this.options.scale = scale;
    this.onChangeScale?.(scale);
  }
  setLayoutType(layoutType: typeof this.options.layoutType) {
    this.options.layoutType = layoutType;
    this.onChangeLayoutType?.(layoutType);
  }
  setDebug(debug: typeof this.options.debug) {
    this.options.debug = debug;
    this.onChangeDebug?.(debug);
  }
  setAdvanced(advanced: typeof this.options.advanced) {
    this.options.advanced = advanced;
    this.onChangeAdvanced?.(advanced);
  }
}
