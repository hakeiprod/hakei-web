import {
  filter,
  firstBy,
  flat,
  isIncludedIn,
  isTruthy,
  map,
  pipe,
  prop,
} from "remeda";
import { match } from "ts-pattern";
import * as Sheet from ".";
import * as Core from "../core";
export class Chord extends Core.Event<{ id: number }> {
  readonly id;
  score!: Sheet.Score;
  word = new Sheet.Word();
  noteheadsLigature = new Sheet.Ligature();
  get notes() {
    return this.score.notes.filter((note) => note.chordId === this.id);
  }
  get slot() {
    return this.score.slots.find((slot) => slot.chords.includes(this))!;
  }
  get beamGroup() {
    return this.score.beamGroups.find((beamGroup) =>
      isIncludedIn(this.id, pipe(beamGroup.chordIds)),
    );
  }
  get start() {
    return firstBy(this.notes, [prop("start"), "asc"])!.start;
  }
  get end() {
    return firstBy(this.notes, [prop("end"), "desc"])!.end;
  }
  get staveId() {
    return this.notes[0].staveId!;
  }
  get trackId() {
    return this.notes[0].trackId!;
  }
  get voice() {
    return this.notes[0].voice;
  }
  get stem() {
    return this.notes[0].stem;
  }
  get beam() {
    return this.notes[0].beam;
  }
  get height() {
    return pipe(
      this.notes,
      flat(),
      map((note) => ({
        top: note.line,
        bottom: note.line + note.glyph.height,
      })),
      (bounds) => {
        if (bounds.length === 0) return 0;
        const minY = Math.min(...bounds.map((b) => b.top));
        const maxY = Math.max(...bounds.map((b) => b.bottom));
        return maxY - minY;
      },
    );
  }
  get width() {
    return firstBy(this.notes, prop("width"))?.width ?? 0;
  }
  get right() {
    return firstBy(this.notes, [prop("glyph", "right"), "desc"])!.glyph.right;
  }
  get left() {
    return firstBy(this.notes, [prop("glyph", "left"), "desc"])!.glyph.left;
  }
  get line() {
    return firstBy(this.notes, [prop("line"), "desc"])?.line ?? 0;
  }
  get stemX() {
    return match(this.stem?._ ?? "none")
      .with("up", () => this.right)
      .with("down", () => this.left)
      .with("double", () => {
        throw new Error("wip");
      })
      .with("none", () => 0)
      .exhaustive();
  }
  get stemLength() {
    return this.beamGroup?.calculateStemLength(this) ?? 3;
  }
  constructor({ id, ...event }: { id: number }) {
    super(event);
    this.id = id;
  }
  serialize() {
    return { id: this.id };
  }
  export() {
    return this.serialize();
  }
  static import(data: ReturnType<Chord["export"]>) {
    return new Chord(data);
  }
  draw() {
    this.noteheadsLigature.append(this.notes.map(prop("glyph")));
    this.word.append(
      pipe(this.notes, map(prop("accidentalGlyph")), filter(isTruthy)),
      [this.noteheadsLigature],
      this.notes.map(prop("dotLigature")),
    );
  }
}
