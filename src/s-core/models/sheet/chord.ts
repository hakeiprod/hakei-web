import {
  filter,
  firstBy,
  flat,
  isIncludedIn,
  isTruthy,
  map,
  pipe,
  prop,
  times,
} from "remeda";
import { match, P } from "ts-pattern";
import * as Sheet from ".";
import * as Core from "../core";
export class Chord extends Core.Event<{ id: number }> {
  readonly id;
  score!: Sheet.Score;
  word = new Sheet.Word();
  noteheadsLigature = new Sheet.Ligature();
  legerlinesLigature = new Sheet.Ligature();
  get notes() {
    return this.score.notes.filter((note) => note.chordId === this.id);
  }
  get maxPitchNote() {
    return pipe(
      this.notes,
      filter((note) => !note.rest),
      firstBy([prop("pitch"), "desc"]),
    );
  }
  get minPitchNote() {
    return pipe(
      this.notes,
      filter((note) => !note.rest),
      firstBy(prop("pitch")),
    );
  }
  get keysignature() {
    return this.notes[0].keysignature;
  }
  get slot() {
    return this.score.slots.find((slot) => slot.chords.includes(this))!;
  }
  get stave() {
    return this.notes[0].stave;
  }
  get track() {
    return this.notes[0].track;
  }
  get beamGroup() {
    return this.score.beamGroups.find((beamGroup) =>
      isIncludedIn(this.id, pipe(beamGroup.chordIds)),
    );
  }
  get start() {
    return firstBy(this.notes, prop("start"))!.start;
  }
  get end() {
    return firstBy(this.notes, [prop("end"), "desc"])!.end;
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
  get legerlines() {
    if (!this.maxPitchNote || !this.minPitchNote) return [];
    const bounds = match(this.stave.resolveClefs()[0]?.sign![0]._)
      .with("G", () => ({
        max: new Core.Units.ScientificPitchNotation("F5"),
        min: new Core.Units.ScientificPitchNotation("E4"),
      }))
      .with("F", () => ({
        max: new Core.Units.ScientificPitchNotation("A3"),
        min: new Core.Units.ScientificPitchNotation("G2"),
      }))
      .with(P.union("C", "TAB", "jianpu", "none", "percussion"), () => {
        throw new Error("wip");
      })
      .exhaustive();
    console.log(
      bounds.max.getDegree(
        this.maxPitchNote.pitch.toScientificPitchNotation(this.keysignature),
      ),
      this.minPitchNote.pitch
        .toScientificPitchNotation(this.keysignature)
        .getDegree(bounds.min) / 2,
    );
    return [
      ...times(
        this.maxPitchNote.pitch
          .toScientificPitchNotation(this.keysignature)
          .getDegree(bounds.max) / 2,
        (index) => index + 6,
      ),
      ...times(
        bounds.min.getDegree(
          this.minPitchNote.pitch.toScientificPitchNotation(this.keysignature),
        ) / 2,
        (index) => index,
      ),
    ];
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
    this.legerlinesLigature.append(
      this.legerlines.map(
        (legerline) => new Sheet.Glyph(Sheet.ElementType.LegerLine, legerline),
      ),
    );
  }
}
