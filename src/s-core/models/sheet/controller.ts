import { drainSteps, type RenderSteps } from "./render-steps";
import { LayoutPass } from "./layout-pass";
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
  protected preparedLayout: { pass: LayoutPass; signature: string } | null =
    null;
  protected layoutSignature() {
    return JSON.stringify({
      ...this.options,
      layoutWidth: this.layoutWidth,
      pageLayout: this.pageLayout,
    });
  }
  protected consumePreparedLayout() {
    const prepared = this.preparedLayout;
    this.preparedLayout = null;
    return (
      prepared?.pass === this.score.layoutPass &&
      prepared?.signature === this.layoutSignature()
    );
  }

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
    return drainSteps(this.mountSteps());
  }
  *mountSteps() {
    this.score.layoutPass = null;
    yield* this.prepareNotesSteps();
    this.setRows();
    yield;
    yield* this.prepareScoreSteps();
    yield* this.layoutSteps();
    if (this.score.layoutPass)
      this.preparedLayout = {
        pass: this.score.layoutPass,
        signature: this.layoutSignature(),
      };
  }
  protected *prepareNotesSteps(): RenderSteps<void> {
    this.prepareNotes();
    yield;
  }
  protected *prepareScoreSteps(): RenderSteps<void> {
    this.prepareScore();
    yield;
  }
  protected *prepareStavesSteps(staves: import("./stave").Stave[]) {
    for (const stave of staves) {
      this.prepareStaves([stave]);
      yield;
    }
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
    return drainSteps(this.layoutSteps());
  }
  *layoutSteps() {
    this.preparedLayout = null;
    this.score.layoutPass = new LayoutPass();
    for (const slot of this.score.slots) slot.spacing = 0;
    for (const masterbar of this.score.masterbars)
      masterbar.allocatedWidth = undefined;
    this.setRows();
    let row = this.score.rows[0];
    let width = 0;
    for (const masterbar of this.score.masterbars) {
      masterbar.rowId = row.id;
      this.score.layoutPass.invalidate();
      yield* this.prepareStavesSteps(
        masterbar.bars.flatMap((bar) => bar.staves),
      );
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
        this.score.layoutPass.invalidate();
        yield* this.prepareStavesSteps(
          masterbar.bars.flatMap((bar) => bar.staves),
        );
        width = 0;
      }
      width += masterbar.minWidth;
      yield;
    }
  }
  space() {
    return drainSteps(this.spaceSteps());
  }
  *spaceSteps() {
    this.score.layoutPass?.invalidate();
    // Recompute from natural glyph widths so repeated draws do not grow.
    for (const slot of this.score.slots) slot.spacing = 0;
    for (const masterbar of this.score.masterbars)
      masterbar.allocatedWidth = undefined;
    if (this.options.layoutType !== LayoutType.Page) return;
    for (const row of this.score.rows) {
      const remaining = Math.max(0, this.layoutWidth - row.minWidth);
      if (remaining === 0) continue;
      const naturalWidth = row.minWidth;
      for (const masterbar of row.masterbars) {
        const extra =
          naturalWidth > 0
            ? (remaining * masterbar.minWidth) / naturalWidth
            : remaining / row.masterbars.length;
        masterbar.allocatedWidth = masterbar.minWidth + extra;
        const slots = [...new Set(masterbar.slots)];
        for (const slot of slots) {
          slot.spacing = extra / slots.length;
          yield;
        }
        yield;
      }
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
