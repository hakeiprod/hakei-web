import { drainSteps, mapSteps } from "../sheet/render-steps";
import { resolveAccidentalsSteps } from "../sheet/notation/accidentals";
import * as Sheet from "@/s-core/models/sheet";
import * as Engraving from "./";
export class Controller extends Sheet.Controller {
  declare public score: Engraving.Score;
  constructor(
    score: Engraving.Score,
    public options: ConstructorParameters<typeof Sheet.Controller>[1],
  ) {
    super(score, options);
  }
  unmount() {
    this.preparedLayout = null;
    this.score.layoutPass = null;
    for (const data of [
      // ...this.score.notes,
      ...this.score.timesignatures,
      ...this.score.keysignatures,
    ])
      data.ligature = new Engraving.Ligature();
    for (const data of this.score.chords)
      data.noteheadsLigature = new Engraving.Ligature();
    for (const data of [...this.score.chords, ...this.score.staves])
      data.word = new Engraving.Word();
  }
  private resolveNotation() {
    return drainSteps(this.resolveNotationSteps());
  }
  private *resolveNotationSteps() {
    const notes = yield* mapSteps(this.score.notes, function* (note) {
      yield;
      return {
        ...note.export(),
        ...(note.rest || note.tablature || note.percussion
          ? { notatedPitch: undefined }
          : { notatedPitch: note.spelling }),
      };
    });
    const decisions = yield* resolveAccidentalsSteps(
      notes,
      this.score.masterbars.map((bar) => bar.export()),
      this.score.keysignatures.map((key) => key.export()),
    );
    for (const note of this.score.notes) {
      note.accidentalDecision = decisions.get(`${note.trackId}:${note.id}`);
      yield;
    }
  }
  draw() {
    return drainSteps(this.drawSteps());
  }
  *drawSteps() {
    this.preparedLayout = null;
    this.score.layoutPass = null;
    yield* this.resolveNotationSteps();
    for (const data of [
      ...this.score.notes,
      ...this.score.chords,
      ...this.score.timesignatures,
      ...this.score.keysignatures,
      ...this.score.staves,
    ]) {
      if (data instanceof Engraving.Chord) yield* data.drawSteps();
      else data.draw();
      yield;
    }
  }
  order() {
    return drainSteps(this.orderSteps());
  }
  *orderSteps() {
    for (const stave of this.score.staves) {
      if (stave.word) yield* stave.word.orderSteps();
      yield;
    }
    for (const chord of this.score.chords) {
      yield* chord.word.orderSteps();
      yield;
    }
    this.score.layoutPass?.invalidate();
  }
  protected override *prepareNotesSteps() {
    yield* this.resolveNotationSteps();
    for (const note of this.score.notes) {
      note.draw();
      yield;
    }
    for (const chord of this.score.chords) {
      yield* chord.drawSteps();
      yield;
    }
  }
  protected override *prepareScoreSteps() {
    yield* this.drawSteps();
  }

  protected override prepareNotes() {
    this.resolveNotation();
    for (const note of this.score.notes) note.draw();
    for (const chord of this.score.chords) chord.draw();
  }
  protected override prepareScore() {
    this.draw();
  }
  protected override prepareStaves(staves: Sheet.Stave[]) {
    for (const stave of staves as Engraving.Stave[]) {
      stave.word = new Engraving.Word();
      stave.draw();
    }
  }
  toDocument() {
    return drainSteps(this.toDocumentSteps());
  }
  *toDocumentSteps() {
    if (!this.consumePreparedLayout()) yield* this.layoutSteps();
    yield* this.spaceSteps();
    yield* this.orderSteps();
    const debug =
      typeof this.options.debug === "boolean"
        ? this.options.debug
        : this.options.debug.enabled;
    return yield* this.score.toDocumentSteps({
      debug,
      pageLayout:
        this.options.layoutType === Sheet.LayoutType.Page
          ? this.pageLayout
          : undefined,
    });
  }
}
