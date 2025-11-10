import { match } from "ts-pattern";
import { LiteralToPrimitiveDeep, PartialDeep, Merge } from "type-fest";
import {
  isDefined,
  prop,
  pipe,
  flatMap,
  firstBy,
  isEmpty,
  mergeDeep,
  isNullish,
  filter,
  entries,
  piped,
  last,
  mapToObj,
} from "remeda";
import * as Core from "../core";
export class Score<
  Note extends Core.Note = Core.Note,
  Track extends Core.Track = Core.Track,
  Timesignature extends Core.Timesignature = Core.Timesignature,
  Keysignature extends Core.Keysignature = Core.Keysignature,
  Tempo extends Core.Tempo = Core.Tempo,
> extends Core.Event {
  override get start() {
    return firstBy(this.tracks, [prop("start"), "asc"])!.start;
  }
  override get end() {
    return firstBy(this.tracks, [prop("end"), "asc"])!.end;
  }
  name;
  timesignatures;
  keysignatures;
  tempos;
  tracks;
  notes;
  get params() {
    return {
      ...super.params,
      name: this.name,
    };
  }
  constructor({
    name = "",
    tracks,
    notes,
    timesignatures,
    keysignatures,
    tempos,
    ...event
  }: {
    tracks: Track[];
    notes: Note[];
    timesignatures: [Timesignature, ...Timesignature[]];
    keysignatures: [Keysignature, ...Keysignature[]];
    tempos: [Tempo, ...Tempo[]];
    name?: string;
  }) {
    super(event);
    this.name = name;
    this.timesignatures = timesignatures;
    this.keysignatures = keysignatures;
    this.tempos = tempos;
    this.tracks = tracks;
    this.notes = notes;
    for (const track of this.tracks) track.score = this;
  }
  static create(
    parameter: Parameter,
    options?: {
      defaultValue?: PartialDeep<
        LiteralToPrimitiveDeep<typeof Core.Metadata.defaultValue>
      >;
    }
  ) {
    const defaultValue = mergeDeep(
      options?.defaultValue ?? {},
      Core.Metadata.defaultValue
    );
    for (const key of ["keysignatures", "timesignatures", "tempos"] as const) {
      if (isNullish(parameter[key]) || isEmpty(parameter[key]))
        match(key)
          .with(
            "timesignatures",
            (key) => (parameter[key] = [defaultValue[key]])
          )
          .with(
            "keysignatures",
            (key) => (parameter[key] = [defaultValue[key]])
          )
          .with("tempos", (key) => (parameter[key] = [defaultValue[key]]))
          .exhaustive();
      if (parameter[key]?.length === 1) parameter[key][0]!.start = 0;

      parameter[key]?.toReversed().reduce(
        (accumulator, current) => {
          current.end = accumulator.start;
          return current;
        },
        {
          start: pipe(
            parameter.tracks,
            flatMap(prop("notes")),
            firstBy([
              (note) => note.end ?? (note.start ?? 0) + (note.duration ?? 0),
              "desc",
            ]),
            (note) => note?.end ?? (note?.start ?? 0) + (note?.duration ?? 0)
          ),
          duration: -1,
          end: -1,
        } as EventParameter
      );
    }

    const { ...score } = parameter;
    const core = new Core.Score({
      ...score,
      timesignatures: parameter.timesignatures?.map(
        ({ start, end, duration, ...timesignature }) =>
          new Core.Timesignature({
            ...timesignature,
            ...pipe(
              { start, duration, end },
              entries(),
              filter(piped(last, isDefined)),
              mapToObj(([key, value]) => [key, new Core.Units.Beat(value!)])
            ),
          })
      ) as [Core.Timesignature, ...Core.Timesignature[]],
      keysignatures: parameter.keysignatures?.map(
        ({ start, end, duration, ...keysignature }) =>
          new Core.Keysignature({
            ...keysignature,
            ...pipe(
              { start, duration, end },
              entries(),
              filter(piped(last, isDefined)),
              mapToObj(([key, value]) => [key, new Core.Units.Beat(value!)])
            ),
          })
      ) as [Core.Keysignature, ...Core.Keysignature[]],
      tempos: parameter.tempos?.map(
        ({ start, end, duration, ...tempo }) =>
          new Core.Tempo({
            value: new Core.Units.Tempo(tempo.value),
            ...pipe(
              { start, duration, end },
              entries(),
              filter(piped(last, isDefined)),
              mapToObj(([key, value]) => [key, new Core.Units.Beat(value!)])
            ),
          })
      ) as [Core.Tempo, ...Core.Tempo[]],
      notes: parameter.tracks.flatMap((track, trackId) =>
        track.notes.map(
          ({ start, duration, end, ...note }, id) =>
            new Core.Note({
              ...note,
              id,
              trackId,
              velocity: note.velocity ?? defaultValue.note.velocity,
              pitch: new Core.Units.MidiNoteNumber(note.pitch),
              ...pipe(
                { start, duration, end },
                entries(),
                filter(piped(last, isDefined)),
                mapToObj(([key, value]) => [key, new Core.Units.Beat(value!)])
              ),
            })
        )
      ),
      tracks: parameter.tracks.map(
        ({ start, duration, end, ...track }, trackId) =>
          new Core.Track({
            ...track,
            id: trackId,
            preset: new Core.Units.Preset(
              track.preset ?? defaultValue.track.preset
            ),
            ...pipe(
              { start, duration, end },
              entries(),
              filter(piped(last, isDefined)),
              mapToObj(([key, value]) => [key, new Core.Units.Beat(value!)])
            ),
          })
      ),
    });
    return core;
  }
}

interface EventParameter {
  start?: number;
  duration?: number;
  end?: number;
}
export interface Parameter<Track = {}, Note = {}> {
  tracks: Merge<
    Omit<ConstructorParameters<typeof Core.Track>[0], "score" | "id">,
    EventParameter & {
      preset?: number;
      notes: Merge<
        Omit<ConstructorParameters<typeof Core.Note>[0], "id" | "trackId">,
        EventParameter & { pitch: number; velocity?: number } & Note
      >[];
    } & Track
  >[];
  keysignatures?: Merge<
    ConstructorParameters<typeof Core.Keysignature>[0],
    EventParameter
  >[];
  timesignatures?: Merge<
    ConstructorParameters<typeof Core.Timesignature>[0],
    EventParameter
  >[];
  tempos?: Merge<
    ConstructorParameters<typeof Core.Tempo>[0],
    EventParameter & { value: number }
  >[];
}
