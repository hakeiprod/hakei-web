import { resolveAccidentals } from "../sheet/notation/accidentals";
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
    const notes = this.score.notes.map((note) => ({
      ...note.export(),
      ...(note.rest || note.tablature || note.percussion
        ? { notatedPitch: undefined }
        : { notatedPitch: note.spelling }),
    }));
    const decisions = resolveAccidentals(
      notes,
      this.score.masterbars.map((bar) => bar.export()),
      this.score.keysignatures.map((key) => key.export()),
    );
    for (const note of this.score.notes)
      note.accidentalDecision = decisions.get(`${note.trackId}:${note.id}`);
  }
  draw() {
    this.resolveNotation();
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
    this.layout();
    this.space();
    this.order();
    const debug =
      typeof this.options.debug === "boolean"
        ? this.options.debug
        : this.options.debug.enabled;
    return this.score.toDocument({
      debug,
      pageLayout:
        this.options.layoutType === Sheet.LayoutType.Page
          ? this.pageLayout
          : undefined,
    });
  }
}
