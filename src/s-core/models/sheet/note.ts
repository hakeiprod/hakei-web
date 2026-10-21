import { diatonicPosition } from "./notation/pitch";
import {
  copyNotation,
  stepSemitones,
  type NotatedPitch,
  type ExplicitAccidental,
  type VisualTie,
} from "./notation/schema";
import { P, match } from "ts-pattern";
import * as Sheet from ".";
import {
  Note as MxlNote,
  NormalType,
  Stem,
} from "../../const/musicxml/4.0/musicxml";
import * as Core from "../core";

export class Note extends Core.Note {
  declare tablature?: import("./notation/schema").NotationFields["tablature"];
  declare percussion?: import("./notation/schema").NotationFields["percussion"];
  declare performanceEventId?: string;
  declare sourceNotation?: import("./notation/schema").NotationFields["sourceNotation"];
  readonly id;
  staveId;
  chordId;
  stem;
  rest;
  voice;
  beam;
  notatedType;
  notatedDots;
  ties;
  notatedPitch?: NotatedPitch;
  explicitAccidental?: ExplicitAccidental;
  visualTies?: VisualTie[];
  score!: Sheet.Score;
  /** Glyph dimensions are supplied by the engraving model. */
  get width(): number {
    throw new Error("Note width requires an engraving model.");
  }
  get track() {
    return this.score.tracks.find((track) => track.id === this.trackId)!;
  }
  get stave() {
    return (
      this.score.staves.find(
        (stave) =>
          stave.trackId === this.trackId &&
          stave.id === this.staveId &&
          this.start.value >= stave.bar.masterbar.start.value &&
          this.start.value < stave.bar.masterbar.end.value,
      ) ??
      this.score.staves.find(
        (s) => s.trackId === this.trackId && s.id === this.staveId,
      )!
    );
  }
  get keysignature() {
    return this.score.keysignatures.find((keysignature) =>
      this.isOverlapped(keysignature),
    )!;
  }
  get accidental() {
    // TODO: Natural
    if (this.rest || !this.pitch || this.tablature || this.percussion)
      return null;
    return match(
      this.pitch.toPitchClass().toPitchClassName(this.keysignature).accidental,
    )
      .with("#", () => Sheet.AccidentalType.Sharp)
      .with("b", () => Sheet.AccidentalType.Flat)
      .with("", () => null)
      .exhaustive();
  }
  get spelling(): NotatedPitch {
    if (this.notatedPitch) return this.notatedPitch;
    if (!this.pitch) throw new Error("Unpitched note has no spelling");
    const name = this.pitch.toScientificPitchNotation(this.keysignature);
    const accidental = name.alter;
    const alter = accidental.includes("#")
      ? accidental.length
      : accidental.includes("b")
        ? -accidental.length
        : 0;
    return {
      step: name.step,
      octave: (this.pitch.value - stepSemitones[name.step] - alter) / 12 - 1,
      alter,
    };
  }
  get line() {
    if (this.rest) {
      if (this.stave.bar.masterbar.duration.equal(this.duration)) return 3;
      return match(this.type._)
        .with(P.union("quarter", "half"), () => 2)
        .otherwise(() => 0);
    }
    if (this.tablature) return 5 - (this.tablature.string - 1);
    if (this.percussion)
      return (
        1 +
        (diatonicPosition({
          step: this.percussion.displayStep,
          octave: this.percussion.displayOctave,
        }) -
          diatonicPosition({ step: "E", octave: 4 })) /
          2
      );
    const clef = this.stave.getClefScientificPitchNotation();
    return (
      (this.stave.resolveClefs()[0].line?.[0]?._ ?? 0) -
      (diatonicPosition({ step: clef.step, octave: clef.octave }) -
        diatonicPosition(this.spelling)) /
        2
    );
  }

  get type() {
    if (this.notatedType) return this.notatedType;
    const tripletBase = this.duration.value * 1.5;
    const power = Math.log2(tripletBase);
    const base =
      Math.abs(power - Math.round(power)) <= 1e-9
        ? Math.pow(2, Math.round(power))
        : Math.pow(2, Math.floor(Math.log2(this.duration.value)));
    return <NormalType>{
      _: match(base)
        .with(32, () => "maxima")
        .with(16, () => "long")
        .with(8, () => "breve")
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
    if (this.notatedDots !== undefined) return this.notatedDots;
    const base = Math.pow(2, Math.floor(Math.log2(this.duration.value)));
    for (let count = 0; count <= 4; count++) {
      if (
        Math.abs(this.duration.value - base * (2 - Math.pow(2, -count))) <= 1e-9
      )
        return count;
    }
    return 0;
  }
  constructor(
    note: {
      tablature?: import("./notation/schema").NotationFields["tablature"];
      percussion?: import("./notation/schema").NotationFields["percussion"];
      performanceEventId?: string;
      sourceNotation?: import("./notation/schema").NotationFields["sourceNotation"];
      notatedPitch?: NotatedPitch;
      explicitAccidental?: ExplicitAccidental;
      visualTies?: VisualTie[];
      ties?: ("start" | "stop")[];
      notatedType?: NormalType;
      notatedDots?: number;
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
    const {
      id,
      staveId,
      rest = false,
      chordId,
      stem,
      voice,
      beam,
      notatedType,
      notatedDots,
      ties,
    } = note;
    super(note);
    this.id = id;
    this.staveId = staveId;
    this.chordId = chordId;
    this.stem = stem;
    this.rest = rest;
    this.voice = voice;
    this.beam = beam;
    this.notatedType = notatedType;
    this.notatedDots = notatedDots;
    this.ties = ties;
    Object.assign(this, copyNotation(note));
  }
  serialize() {
    return {
      ...super.serialize(),
      ...copyNotation(this),
      staveId: this.staveId,
      chordId: this.chordId,
      stem: this.stem,
      rest: this.rest,
      voice: this.voice,
      beam: this.beam,
      ...(this.ties ? { ties: this.ties } : {}),
      ...(this.notatedType ? { notatedType: this.notatedType } : {}),
      ...(this.notatedDots === undefined
        ? {}
        : { notatedDots: this.notatedDots }),
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
