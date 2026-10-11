import { entries, flatMap, groupBy, length, pipe, prop } from "remeda";
import { match } from "ts-pattern";
import { LayoutType, Score } from "./";
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
    // Engraving subclasses prepare dimensions before calculating the layout.
    this.prepareNotes();
    this.setRows();
    this.prepareScore();
    this.layout();
  }
  protected prepareNotes() {}
  protected prepareScore() {}
  protected prepareStaves(staves: import("./stave").Stave[]) {
    // Base sheet models have no engraving state to prepare.
    if (staves.length === 0) return;
  }
  unmount() {}
  order() {}
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
      const prepareStaves = () =>
        this.prepareStaves(masterbar.bars.flatMap((bar) => bar.staves));
      prepareStaves();
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
        prepareStaves();
        width = 0;
      }
      width += masterbar.minWidth;
    }
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
