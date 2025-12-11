import * as Core from "../core";
import * as Sheet from ".";
import {
  Note as MxlNote,
  NoteType,
  Stem,
} from "../../const/musicxml/4.0/musicxml";
import { P, match } from "ts-pattern";
import { times } from "remeda";

export class Note extends Core.Note {
  readonly id;
  staveId;
  chordId;
  stem;
  rest;
  voice;
  beam;
  flag: null = null;
  alter;
  ligature = new Sheet.Ligature(undefined, { type: "note" });
  score!: Sheet.Score;
  override get params() {
    return {
      ...super.params,
      chordId: this.chordId,
      staveId: this.staveId,
      stem: this.stem,
      beam: this.beam,
      rest: this.rest,
      voice: this.voice,
    };
  }
  get track() {
    return this.score.tracks.find((track) => track.id === this.trackId)!;
  }
  get stave() {
    return this.score.staves.find(
      (stave) => stave.trackId === this.trackId && stave.id === this.staveId
    )!;
  }
  get keysignature() {
    return this.score.keysignatures.find((keysignature) =>
      this.isOverlapped(keysignature)
    )!;
  }
  get accidental() {
    // TODO: Natural
    if (this.rest) return null;
    return match(
      this.pitch.toPitchClass().toPitchClassName(this.keysignature.tonality)
        .accidental
    )
      .with("#", () => Sheet.AccidentalType.Sharp)
      .with("b", () => Sheet.AccidentalType.Flat)
      .with("", () => null)
      .exhaustive();
  }
  get line() {
    if (this.rest) {
      if (this.stave.bar.masterbar.duration.equal(this.duration)) return 3;
      return match(this.type._)
        .with(P.union("quarter", "half"), () => 2)
        .otherwise(() => 0);
    }
    return (
      (this.stave.resolveClefs()[0]?.$$.line?.[0]?._ ?? 0) -
      this.stave
        .getClefScientificPitchNotation()
        .getDegree(
          this.pitch.toScientificPitchNotation(this.keysignature.tonality)
        ) /
        2
    );
  }
  get type() {
    return <NoteType>{
      _: match(Math.pow(2, Math.floor(Math.log2(this.duration.value))))
        .with(4, () => "whole")
        .with(2, () => "half")
        .with(1, () => "quarter")
        .with(0.5, () => "eighth")
        .with(0.25, () => "16th")
        .with(0.125, () => "32nd")
        .with(0.0625, () => "64th")
        .with(0.031_25, () => "128th")
        .with(0.015_625, () => "256th")
        .with(0.007_812_5, () => "512th")
        .with(0.003_906_25, () => "1024th")
        .otherwise(() => "quarter"),
    };
  }
  // FIXME:
  get legerLine() {
    return match(this.stave.resolveClefs()[0]?.$$.sign![0]._)
      .with("G", () => this.pitch.value > 80 || this.pitch.value <= 60)
      .with("F", () => 60 >= this.pitch.value || this.pitch.value <= 43)
      .with(P.union("C", "TAB", "jianpu", "none", "percussion"), () => {
        throw new Error("wip");
      })
      .exhaustive()
      ? Math.ceil((this.pitch.value - 59) / 2)
      : 0;
  }
  get dot() {
    let duration = this.duration.value;
    let dot = 0;
    while (
      duration % Math.pow(2, Math.floor(Math.log2(this.duration.value))) !==
      0
    ) {
      duration *= 2;
      dot += 1;
    }
    return dot;
  }
  constructor(
    note: {
      id: number;
      staveId: number;
      chordId?: number;
      stem?: Stem;
      rest?: boolean;
      beam?: MxlNote["$$"]["beam"];
      alter?: number;
      voice: number;
    } & ConstructorParameters<typeof Core.Note>[0]
  ) {
    const {
      id,
      staveId,
      rest = false,
      chordId,
      stem,
      voice,
      beam,
      alter,
    } = note;
    super(note);
    this.id = id;
    this.alter = alter;
    this.staveId = staveId;
    this.chordId = chordId;
    this.stem = stem;
    this.rest = rest;
    this.voice = voice;
    this.beam = beam;
  }
  draw() {
    const noteLigature = new Sheet.Ligature();
    noteLigature.append([new Sheet.Glyph(Sheet.ElementType.Notehead, 0)]);
    if (this.stem)
      noteLigature.append([new Sheet.Glyph(Sheet.ElementType.Stem, 0)]);

    if (this.accidental)
      this.ligature.append([new Sheet.Glyph(Sheet.ElementType.Accidental, 0)]);

    this.ligature.line = this.line;
    this.ligature.append(
      [
        ...(this.legerLine
          ? times(
              this.legerLine,
              () => new Sheet.Glyph(Sheet.ElementType.LegerLine, 0)
            )
          : []),
        this.rest ? new Sheet.Glyph(Sheet.ElementType.Rest, 0) : noteLigature,
      ],
      ...times(this.dot, () => [new Sheet.Glyph(Sheet.ElementType.Dot, 0)])
    );
  }

  serialize() {
    return {
      ...super.serialize(),
      staveId: this.staveId,
      chordId: this.chordId,
      stem: this.stem,
      rest: this.rest,
      voice: this.voice,
      beam: this.beam,
      flag: this.flag,
      accidental: this.accidental,
      alter: this.alter,
    };
  }
  export() {
    return this.serialize();
  }
  static import(data: ReturnType<Note["export"]>) {
    const core = super.import(data);
    return new Note({
      ...data,
      ...core,
      start: core.start,
      duration: core.duration,
      end: core.end,
    });
  }
}
