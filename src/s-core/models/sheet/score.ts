import {
  filter,
  firstBy,
  flatMap,
  isNullish,
  map,
  pipe,
  piped,
  prop,
  reduce,
  uniqueBy,
} from "remeda";
import { match, P } from "ts-pattern";
import * as Sheet from ".";
import * as Core from "../core";

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
    ].toSorted((a, b) => a.start.subtract(b.start).value);
  }
  get height() {
    return this.rows.reduce(
      (accumulator, current) => accumulator + current.height,
      0,
    );
  }
  get width() {
    return firstBy(this.rows, [prop("width"), "desc"])?.width ?? 0;
  }
  override get start(): Core.Units.Beat {
    return firstBy(this.masterbars, [prop("start"), "asc"])!.start;
  }
  override get end(): Core.Units.Beat {
    return firstBy(this.masterbars, [prop("end"), "desc"])!.end;
  }
  constructor({
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
  >[0]) {
    super(score);
    this.bars = bars;
    this.staves = staves;
    this.rows = rows;
    this.masterbars = masterbars;
    this.chords = chords;
    for (const data of [
      ...this.notes,
      ...this.staves,
      ...this.bars,
      ...this.masterbars,
      ...this.rows,
      ...this.chords,
    ])
      data.score = this;
    this.slots = pipe(
      this.masterbars,
      flatMap(
        piped(
          (masterbar) => masterbar.notes,
          map((note) => note.start),
          uniqueBy((beat) => beat.value),
          (beats) =>
            beats.reduce(
              (accumulator, current) => {
                const slot = new Sheet.Slot({
                  beat: current,
                  previousSlot: accumulator.prevSlot,
                }) as Slot;
                slot.score = this;
                accumulator.prevSlot = slot;
                accumulator.slots.push(slot);
                return accumulator;
              },
              { slots: [], prevSlot: undefined } as {
                slots: Slot[];
                prevSlot?: Slot;
              },
            ),
          prop("slots"),
        ),
      ),
    );
    this.beamGroups = this.staves.flatMap((stave) =>
      pipe(
        stave.chords,
        reduce(
          (accumulator, current) => {
            for (const beam of current.beam ?? []) {
              const level = Number(beam.$?.number) - 1;
              match(beam._)
                .with(P.union("begin", "backward hook", "forward hook"), () =>
                  accumulator.push({
                    level,
                    chordIds: [current.id],
                    staveId: stave.id,
                    barId: stave.barId,
                    trackId: stave.trackId,
                  }),
                )
                .with(P.union("continue", "end"), () =>
                  accumulator
                    .findLast((beam) => beam.level === level)
                    ?.chordIds.push(current.id),
                )
                .with(undefined, () => {
                  throw new Error("wip");
                })
                .exhaustive();
            }
            return accumulator;
          },
          [] as ConstructorParameters<typeof Sheet.BeamGroup>[0][],
        ),
        map((beam) => {
          const beamGroup = new Sheet.BeamGroup(beam);
          beamGroup.score = this;
          return beamGroup;
        }),
      ),
    );
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
    return new Score({
      ...data,
      ...super.import(data),
      notes: data.notes.map(Sheet.Note.import),
      tracks: data.tracks.map(Sheet.Track.import),
      timesignatures: data.timesignatures.map(Sheet.Timesignature.import),
      keysignatures: data.keysignatures.map(Sheet.Keysignature.import),
      bars: data.bars.map(Sheet.Bar.import),
      staves: data.staves.map(Sheet.Stave.import),
      masterbars: data.masterbars.map(Sheet.Masterbar.import),
      chords: data.chords.map(Sheet.Chord.import),
    });
  }
}
