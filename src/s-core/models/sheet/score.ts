import {
  filter,
  firstBy,
  isNonNullish,
  isNullish,
  map,
  pipe,
  piped,
  prop,
} from "remeda";
import { match, P } from "ts-pattern";
import * as Sheet from ".";
import * as Core from "../core";
import { LayoutIndex } from "./layout-index";
import { LayoutPass } from "./layout-pass";
import { drainSteps, sortSteps } from "./render-steps";
import { importScorePartsSteps } from "./import-score-parts";

export class Score<
  Note extends Sheet.Note = Sheet.Note,
  Track extends Sheet.Track = Sheet.Track,
  Stave extends Sheet.Stave = Sheet.Stave,
  Bar extends Sheet.Bar = Sheet.Bar,
  Masterbar extends Sheet.Masterbar = Sheet.Masterbar,
  Row extends Sheet.Row = Sheet.Row,
  Timesignature extends Sheet.Timesignature = Sheet.Timesignature,
  Slot extends Sheet.Slot = Sheet.Slot,
  Chord extends Sheet.Chord = Sheet.Chord,
  Keysignature extends Sheet.Keysignature = Sheet.Keysignature,
  Tempo extends Core.Tempo = Core.Tempo,
> extends Core.Score<Note, Track, Timesignature, Keysignature, Tempo> {
  rows;
  masterbars: Masterbar[];
  slots: Slot[];
  bars: Bar[];
  staves: Stave[];
  chords: Chord[];
  virtualNotes: Note[] = [];
  beamGroups: Sheet.BeamGroup[];
  get events() {
    return [
      ...pipe(this.notes, filter(piped(prop("chordId"), isNullish))),
      ...this.chords,
    ].toSorted((a, b) => a.start.value - b.start.value);
  }
  get height() {
    const last = this.rows.at(-1);
    return last ? last.y + last.height : 0;
  }
  get width() {
    return firstBy(this.rows, [prop("width"), "desc"])?.width ?? 0;
  }
  override get start(): Core.Units.Beat {
    return (
      firstBy(this.masterbars, [prop("start"), "asc"])?.start ??
      firstBy(this.notes, [prop("start"), "asc"])?.start ??
      new Core.Units.Beat(0)
    );
  }
  override get end(): Core.Units.Beat {
    return (
      firstBy(this.masterbars, [prop("end"), "desc"])?.end ??
      firstBy(this.notes, [prop("end"), "desc"])?.end ??
      new Core.Units.Beat(0)
    );
  }
  layoutIndex: LayoutIndex | null = null;
  layoutPass: LayoutPass | null = null;
  notesByChordId: Map<number, Note[]> | null = null;
  rebuildLayoutIndex() {
    this.layoutIndex = null;
    this.layoutPass = null;
    this.notesByChordId = null;
    const complete = new LayoutIndex(this);
    this.layoutIndex = complete;
  }
  constructor(
    {
      rows,
      masterbars,
      bars,
      staves,
      chords,
      ...score
    }: {
      staves: Stave[];
      bars: Bar[];
      masterbars: Masterbar[];
      rows: Row[];
      chords: Chord[];
    } & ConstructorParameters<
      typeof Core.Score<Note, Track, Timesignature, Keysignature, Tempo>
    >[0],
    deferred = false,
  ) {
    super(score);
    this.bars = bars;
    this.staves = staves;
    this.rows = rows;
    this.masterbars = masterbars;
    this.chords = chords;
    this.slots = [];
    this.beamGroups = [];
    if (!deferred) drainSteps(this.initializeSteps());
  }
  *initializeSteps() {
    this.layoutIndex = null;
    this.layoutPass = null;
    this.notesByChordId = null;
    this.slots = [];
    this.beamGroups = [];
    for (const data of [
      ...this.notes,
      ...this.staves,
      ...this.bars,
      ...this.masterbars,
      ...this.rows,
      ...this.chords,
    ]) {
      data.score = this;
      yield;
    }
    for (const masterbar of this.masterbars) {
      const seen = new Set<number>();
      let previousSlot: Slot | undefined;
      for (const note of this.notes) {
        if (note.isOverlapped(masterbar) && !seen.has(note.start.value)) {
          seen.add(note.start.value);
          const slot = new Sheet.Slot({
            beat: note.start,
            previousSlot,
          }) as Slot;
          slot.score = this;
          this.slots.push(slot);
          previousSlot = slot;
        }
        yield;
      }
    }
    const index = yield* LayoutIndex.createSteps(this);
    for (const stave of this.staves) {
      const beams: ConstructorParameters<typeof Sheet.BeamGroup>[0][] = [];
      const chords = yield* sortSteps(
        index.staveChords.get(stave) ?? [],
        (a, b) => a.start.value - b.start.value,
      );
      for (const current of chords) {
        for (const beam of current.beam ?? []) {
          const level = Number(beam.$?.number) - 1;
          match(beam._)
            .with(P.union("begin", "backward hook", "forward hook"), () =>
              beams.push({
                level,
                chordIds: [current.id],
                staveId: stave.id,
                barId: stave.barId,
                trackId: stave.trackId,
              }),
            )
            .with(P.union("continue", "end"), () =>
              beams
                .findLast((beam) => beam.level === level)
                ?.chordIds.push(current.id),
            )
            .with(undefined, () => {
              throw new Error("wip");
            })
            .exhaustive();
          yield;
        }
        yield;
      }
      for (const beam of beams) {
        const group = new Sheet.BeamGroup(beam);
        group.score = this;
        this.beamGroups.push(group);
        yield;
      }
      yield;
    }
    yield* index.populateBeamsSteps();
    this.layoutIndex = index;
  }
  export() {
    return {
      ...super.export(),
      notes: this.notes.map((note) => note.export()),
      tracks: map(this.tracks, (data) => data.export()),
      bars: map(this.bars, (data) => data.export()),
      staves: map(this.staves, (data) => data.export()),
      masterbars: map(this.masterbars, (data) => data.export()),
      chords: map(this.chords, (data) => data.export()),
      slots: map(this.slots, (data) => data.export()),
      rows: [],
    };
  }
  static import(data: ReturnType<Score["export"]>) {
    return drainSteps(Score.importSteps(data));
  }
  static *importSteps(data: ReturnType<Score["export"]>) {
    const parts = yield* importScorePartsSteps(data, {
      note: Sheet.Note.import,
      track: Sheet.Track.import,
      stave: Sheet.Stave.import,
      bar: Sheet.Bar.import,
      masterbar: Sheet.Masterbar.import,
      chord: Sheet.Chord.import,
      timesignature: Sheet.Timesignature.import,
      keysignature: Sheet.Keysignature.import,
      tempo: Core.Tempo.import,
    });
    const score = new Score({ ...data, ...parts }, true);
    yield* score.initializeSteps();
    return score;
  }
  getNotesByChordId(chordId: number) {
    if (this.layoutIndex)
      return this.layoutIndex.notesByChordId.get(chordId)! as Note[];
    if (isNullish(this.notesByChordId)) {
      this.notesByChordId = new Map();
      for (const note of this.notes)
        if (isNonNullish(note.chordId)) {
          const list = this.notesByChordId.get(note.chordId) ?? [];
          list.push(note);
          this.notesByChordId.set(note.chordId, list);
        }
    }
    return this.notesByChordId.get(chordId)!;
  }
}
