import { times } from "remeda";
import { P, match } from "ts-pattern";
import * as Sheet from ".";
import {
  Note as MxlNote,
  NormalType,
  Stem,
} from "../../const/musicxml/4.0/musicxml";
import * as Core from "../core";

export class Note extends Core.Note {
  readonly id;
  staveId;
  chordId;
  stem;
  rest;
  voice;
  beam;
  glyph!: Sheet.Glyph;
  dotLigature!: Sheet.Ligature;
  accidentalGlyph?: Sheet.Glyph;
  score!: Sheet.Score;
  get width() {
    return (
      this.glyph.width +
      (this.accidentalGlyph?.width ?? 0) +
      this.dotLigature.width
    );
  }
  get track() {
    return this.score.tracks.find((track) => track.id === this.trackId)!;
  }
  get stave() {
    return this.score.staves.find(
      (stave) => stave.trackId === this.trackId && stave.id === this.staveId,
    )!;
  }
  get keysignature() {
    return this.score.keysignatures.find((keysignature) =>
      this.isOverlapped(keysignature),
    )!;
  }
  get accidental() {
    // TODO: Natural
    if (this.rest) return null;
    return match(
      this.pitch.toPitchClass().toPitchClassName(this.keysignature).accidental,
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
      (this.stave.resolveClefs()[0].line?.[0]?._ ?? 0) -
      this.stave
        .getClefScientificPitchNotation()
        .getDegree(this.pitch.toScientificPitchNotation(this.keysignature)) /
        2
    );
  }
  get type() {
    return <NormalType>{
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
      beam?: MxlNote["beam"];
      alter?: number;
      voice: number;
    } & ConstructorParameters<typeof Core.Note>[0],
  ) {
    const { id, staveId, rest = false, chordId, stem, voice, beam } = note;
    super(note);
    this.id = id;
    this.staveId = staveId;
    this.chordId = chordId;
    this.stem = stem;
    this.rest = rest;
    this.voice = voice;
    this.beam = beam;
  }
  draw() {
    // if (isNonNull(this.accidental))
    //   this.accidentalGlyph = new Sheet.Glyph(
    //     Sheet.ElementType.Accidental,
    //     this.line,
    //   );
    this.glyph = new Sheet.Glyph(
      this.rest ? Sheet.ElementType.Rest : Sheet.ElementType.Notehead,
      this.line,
    );
    this.dotLigature = new Sheet.Ligature(
      times(this.dot, () => [
        new Sheet.Glyph(Sheet.ElementType.Dot, this.line),
      ]),
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
