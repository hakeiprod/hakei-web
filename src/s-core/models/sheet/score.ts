import {
  add,
  entries,
  filter,
  first,
  firstBy,
  flat,
  flatMap,
  identity,
  isDefined,
  isEmpty,
  isNullish,
  isTruthy,
  last,
  length,
  map,
  mapToObj,
  pipe,
  piped,
  prop,
  reduce,
  subtract,
  times,
} from "remeda";
import { match, P } from "ts-pattern";
import { LiteralToPrimitiveDeep, Merge, PartialDeep } from "type-fest";
import * as Sheet from ".";
import { StaffDetails } from "../../const/musicxml/4.0/musicxml";
import * as Core from "../core";

export class Score<
  Note extends Sheet.Note = Sheet.Note,
  Track extends Sheet.Track = Sheet.Track,
  Stave extends Sheet.Stave = Sheet.Stave,
  Bar extends Sheet.Bar = Sheet.Bar,
  Masterbar extends Sheet.Masterbar = Sheet.Masterbar,
  Row extends Sheet.Row = Sheet.Row,
  Timesignature extends Sheet.Timesignature = Sheet.Timesignature,
  Keysignature extends Sheet.Keysignature = Sheet.Keysignature,
  Tempo extends Core.Tempo = Core.Tempo,
  Chord extends Sheet.Chord = Sheet.Chord,
> extends Core.Score<Note, Track, Timesignature, Keysignature, Tempo> {
  rows;
  masterbars: Masterbar[];
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
    this.beamGroups = this.staves.flatMap((stave) =>
      pipe(
        stave.notes,
        reduce(
          (accumulator, current) => {
            for (const beam of current.beam ?? []) {
              const level = Number(beam.$?.number) - 1;
              match(beam._)
                .with(P.union("begin", "backward hook", "forward hook"), () =>
                  accumulator.push({
                    level,
                    notes: [current],
                    staveId: stave.id,
                    barId: stave.barId,
                    trackId: stave.trackId,
                  }),
                )
                .with(P.union("continue", "end"), () =>
                  accumulator
                    .findLast((beam) => beam.level === level)
                    ?.notes.push(current),
                )
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

  static override create(
    parameter: Parameter,
    options?: {
      defaultValue?: PartialDeep<
        LiteralToPrimitiveDeep<typeof Core.Metadata.defaultValue>
      >;
    },
  ) {
    const core = super.create(
      {
        ...parameter,
        tracks: parameter.tracks.map((track) => ({
          ...track,
          notes: track.notes.flat(),
        })),
      },
      options,
    );
    const barEvents = pipe(
      core.timesignatures,
      reduce(
        (accumulator, current) => {
          accumulator.events.push(
            ...times(
              Math.ceil(current.duration.value / current.numerator),
              () => {
                const event = {
                  start: accumulator.start,
                  duration: current.numerator,
                };
                accumulator.start += current.numerator;
                return event;
              },
            ),
          );
          return accumulator;
        },
        {
          start: 0,
          events: [] as { start: number; duration: number }[],
        },
      ),
      prop("events"),
    );
    parameter.masterbars ??= barEvents.map((event, id) => ({
      id,
      ...event,
      barline: { $$: {} },
    }));
    if (isNullish(parameter.masterbars) || isEmpty(parameter.masterbars))
      parameter.masterbars = [
        {
          id: 0,
          start: 0,
          end: parameter.timesignatures![0]?.numerator,
          barline: { $$: {} },
        },
      ];
    parameter.chords ??= pipe(
      parameter.tracks,
      map(
        piped(prop("notes"), (notes) =>
          reduce(
            notes,
            (accumulator, current, index, array) => {
              if (current.chord)
                if (array[index - 1]?.chord) accumulator.at(-1)!.push(current);
                else accumulator.push([array[index - 1]!, current]);
              return accumulator;
            },
            [] as Parameter["tracks"][number]["notes"][number][][],
          ),
        ),
      ),
      map((chords, trackId) =>
        pipe(
          chords,
          map((notes, chordId) => {
            for (const note of notes) note.chordId = chordId;
            return {
              id: chordId,
              trackId,
              staveId: pipe(notes, first(), prop("staveId"))!,
              voice: pipe(notes, first(), prop("voice"))!,
              start: pipe(
                notes,
                map(prop("start")),
                filter(isTruthy),
                firstBy(identity()),
              ),
              duration: pipe(
                notes,
                map(prop("duration")),
                filter(isTruthy),
                firstBy([identity(), "desc"]),
              ),
              end: pipe(
                notes,
                map(prop("duration")),
                filter(isTruthy),
                firstBy([identity(), "desc"]),
              ),
            };
          }),
        ),
      ),
      flat(),
    );

    // 必要以上にbarを生成する場合がありそう
    parameter.bars ??= core.tracks.flatMap((track) =>
      parameter.masterbars!.map((masterbar) => ({
        ...masterbar,
        trackId: track.id,
      })),
    );
    if (isNullish(parameter.bars) || isEmpty(parameter.bars))
      parameter.bars ??= parameter.tracks.map((_, trackId) => ({
        id: 0,
        trackId,
      }));

    parameter.staves ??= core.tracks
      .flatMap((track) =>
        parameter.masterbars!.flatMap((masterbar) =>
          match(track.preset.toName())
            .with("Acoustic Grand Piano", () => {
              return [
                <ConstructorParameters<typeof Sheet.Stave>[0]>{
                  id: 0,
                  barId: masterbar.id, //ここ間違えてね？masterbarIdもいりそう
                  trackId: track.id,
                  clefs: [
                    {
                      $$: {
                        sign: [{ _: "G" }],
                        line: [{ _: 2 }],
                      },
                    },
                  ],
                },
                <ConstructorParameters<typeof Sheet.Stave>[0]>{
                  id: 1,
                  barId: masterbar.id,
                  trackId: track.id,
                  clefs: [
                    {
                      $$: {
                        sign: [{ _: "F" }],
                        line: [{ _: 4 }],
                      },
                    },
                  ],
                },
              ];
            })
            .otherwise(() => {
              return [
                <ConstructorParameters<typeof Sheet.Stave>[0]>{
                  id: 0,
                  barId: masterbar.id,
                  trackId: track.id,
                  clefs: [
                    {
                      $$: {
                        sign: [{ _: "G" }] as const,
                        line: [{ _: 4 }],
                      },
                      $: {},
                    },
                  ],
                },
              ];
            }),
        ),
      )
      .map((stave) => new Sheet.Stave(stave));

    const score = new Sheet.Score({
      ...core,
      timesignatures: core.timesignatures.map(
        (timesignature) => new Sheet.Timesignature(timesignature),
      ) as [Sheet.Timesignature, ...Sheet.Timesignature[]],
      keysignatures: core.keysignatures.map(
        (keysignature) => new Sheet.Keysignature(keysignature),
      ) as [Sheet.Keysignature, ...Sheet.Keysignature[]],
      notes: parameter.tracks.flatMap((track, trackId) =>
        track.notes.map(
          ({ start, duration, end, ...note }, id) =>
            new Sheet.Note({
              ...note,
              id: note.id ?? id,
              trackId,
              pitch: new Core.Units.MidiNoteNumber(note.pitch),
              ...pipe(
                { start, duration, end },
                entries(),
                filter(piped(last, isDefined)),
                mapToObj(([key, value]) => [key, new Core.Units.Beat(value!)]),
              ),
            }),
        ),
      ),
      tracks: core.tracks.map(
        (track, id) =>
          new Sheet.Track({
            ...track,
            staffDetails: parameter.tracks[id]!.staffDetails,
          }),
      ),
      staves: parameter.staves.map((stave) => new Sheet.Stave(stave)),
      bars: parameter.bars.map((bar) => new Sheet.Bar(bar)),
      masterbars: parameter.masterbars.map(
        ({ start, duration, end, ...masterbar }) =>
          new Sheet.Masterbar({
            ...masterbar,
            ...pipe(
              { start, duration, end },
              entries(),
              filter(piped(last, isDefined)),
              mapToObj(([key, value]) => [key, new Core.Units.Beat(value!)]),
            ),
          }),
      ),
      chords:
        parameter.chords?.map(
          ({ start, duration, end, ...chord }) =>
            new Sheet.Chord({
              ...chord,
              ...pipe(
                { start, duration, end },
                entries(),
                filter(piped(last, isDefined)),
                mapToObj(([key, value]) => [key, new Core.Units.Beat(value!)]),
              ),
            }),
        ) ?? [],
      rows: [],
    });

    // set end
    for (const key of [
      "tracks",
      "keysignatures",
      "timesignatures",
      "tempos",
    ] as const)
      score[key].at(-1)!.setEnd(score.masterbars.at(-1)!.end);

    // insert rests
    pipe(
      score.staves,
      flatMap((stave) => {
        return pipe(
          [
            new Core.Event({
              start: stave.bar.masterbar.start,
              end: stave.bar.masterbar.start,
            }) as Sheet.Note,
            ...stave.events,
            new Core.Event({
              start: stave.bar.masterbar.end,
              end: stave.bar.masterbar.end,
            }) as Sheet.Note,
          ],
          reduce(
            (accumulator, current, index) => {
              if (accumulator && accumulator.end.value < current.start.value) {
                const note = new Sheet.Note({
                  id: score.notes.length + index,
                  velocity: 102,
                  start: accumulator.end,
                  end: current.start,
                  staveId: stave.id,
                  trackId: stave.trackId,
                  pitch: new Core.Units.MidiNoteNumber(-1),
                  stem: undefined,
                  rest: true,
                  voice: 1,
                });
                note.score = score;
                score.notes.splice(
                  pipe(
                    score.notes,
                    filter(piped(prop("rest"), isDefined)),
                    length(),
                    add(index),
                    subtract(1),
                  ),
                  0,
                  note,
                );
              }
              return current;
            },
            null as Core.Event | null,
          ),
        );
      }),
    );
    if (process.env.NODE_ENV === "development") console.log({ sheet: score });
    return score;
  }
}
export interface Parameter
  extends Core.Parameter<
    ConstructorParameters<typeof Sheet.Track>[0],
    ConstructorParameters<typeof Sheet.Note>[0],
    { staffDetails: StaffDetails },
    {
      chord?: boolean;
      chordId?: number;
      velocity: number;
      alter?: Sheet.AccidentalType;
    }
  > {
  masterbars?: Merge<
    ConstructorParameters<typeof Sheet.Masterbar>[0],
    Core.EventParameter
  >[];
  bars?: ConstructorParameters<typeof Sheet.Bar>[0][];
  staves?: ConstructorParameters<typeof Sheet.Stave>[0][];
  chords?: Merge<
    ConstructorParameters<typeof Sheet.Chord>[0],
    Core.EventParameter
  >[];
}
