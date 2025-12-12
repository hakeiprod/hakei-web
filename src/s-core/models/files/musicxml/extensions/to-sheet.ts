import {
  add,
  defaultTo,
  entries,
  flatMap,
  groupBy,
  isDefined,
  isNullish,
  last,
  map,
  pipe,
  piped,
  prop,
  reduce,
  take,
  times,
} from "remeda";
import { StaffDetails } from "../../../../const/musicxml/4.0/musicxml";
import * as Core from "../../../core";
import { MidiNoteNumber } from "../../../core/units";
import * as Sheet from "../../../sheet";
import * as MusicXML from "../../musicxml";

declare module ".." {
  interface MXL {
    toSheet(): Sheet.Score;
  }
}
MusicXML.MXL.prototype.toSheet = function (this: MusicXML.MXL) {
  if (process.env.NODE_ENV === "development") console.log({ mxl: this });
  const { keysignatures, timesignatures, tracks, bars, staves, tempos } =
    this.mxl["score-partwise"].$$.part?.reduce(
      (partAccumulator, current, trackId) => {
        const scorePart = this.mxl["score-partwise"].$$["part-list"]?.[0].$$[
          "score-part"
        ]?.find((scorePart) => scorePart.$?.id === current.$?.id);
        const partName = scorePart?.$$["part-name"]?.[0];
        partAccumulator.tracks.push({
          name:
            partName?.$?.["print-object"] === "no" ? "" : (partName?._ ?? ""),
          preset: 0,
          notes: [],
          staffDetails: <StaffDetails>{
            $$: {
              "staff-lines": [{ _: 5 }],
            },
          },
        });
        const { bars } = current.$$.measure?.reduce(
          (measureAccumulator, current_, barId) => {
            const musicData = current_.$$;
            const attributes = prop(musicData, "attributes") ?? [];
            const division = attributes[0]?.$$?.divisions?.[0]?._ as number;
            const staffDetails = attributes[0]?.$$["staff-details"]?.[0];
            const time = attributes[0]?.$$.time?.[0];
            const key = attributes[0]?.$$.key?.[0];
            const tempo = prop(
              musicData,
              "direction",
              0,
              "$$",
              "sound",
              0,
              "$",
              "tempo"
            );
            if (partAccumulator.tracks[trackId])
              partAccumulator.tracks[trackId].staffDetails = staffDetails ?? {
                $$: { "staff-lines": [{ _: 5 }] },
              };
            if (time)
              partAccumulator.timesignatures?.push({
                denominator: Number(prop(time.$$, "beat-type", "0", "_")),
                numerator: Number(prop(time.$$, "beats", "0", "_")),
                start: Number(prop(time.$$, "beats", "0", "_")) * barId,
              });
            if (key)
              partAccumulator.keysignatures?.push({
                accidental: prop(key.$$, "fifths", "0", "_") ?? 0,
                tonality:
                  prop(key.$$, "mode", "at", "_") === "minor"
                    ? Core.Enums.Tonality.Minor
                    : Core.Enums.Tonality.Major,
                start:
                  partAccumulator.timesignatures!.at(-1)!.numerator * barId,
              });
            if (tempo)
              partAccumulator.tempos?.push({
                value: tempo,
                start:
                  partAccumulator.timesignatures!.at(-1)!.numerator * barId,
              });
            if (division) measureAccumulator.division = division;
            const notes = pipe(
              prop(musicData, "note") ?? [],
              groupBy(piped(prop("$$", "staff", 0, "_"), defaultTo(1))),
              entries(),
              flatMap(
                piped(
                  last(),
                  groupBy(piped(prop("$$", "voice", 0, "_"))),
                  entries()
                )
              ),
              map(
                piped(last(), (last) =>
                  last.reduce(
                    (accumulator, current__, index, array) => {
                      const duration =
                        (prop(current__.$$, "duration", "0", "_") as number) /
                        measureAccumulator.division;
                      const rest = isDefined(prop(current__.$$, "rest", "0"));
                      const parameter = {
                        staveId:
                          (prop(current__, "$$", "staff", 0, "_") ?? 1) - 1,
                        velocity: 102,
                        voice: Number(current__.$$.voice?.[0]._ ?? 1),
                        rest,
                        stem: current__.$$.stem?.[0],
                        beam: current__.$$.beam,
                        chord: isDefined(prop(current__.$$, "chord")),
                        alter:
                          prop(current__.$$, "pitch", "0", "$$", "alter")?.[0]
                            ._ ?? 0,
                        pitch: rest
                          ? new MidiNoteNumber(-1).value
                          : new Core.Units.ScientificPitchNotation(
                              `${
                                prop(
                                  current__.$$,
                                  "pitch",
                                  "0",
                                  "$$",
                                  "step",
                                  "0",
                                  "_"
                                ) ?? "C"
                              }${
                                prop(
                                  current__.$$,
                                  "pitch",
                                  "0",
                                  "$$",
                                  "octave",
                                  "0",
                                  "_"
                                ) ?? 0
                              }`
                            ).toMidiNoteNumber().value,
                        start: pipe(
                          array,
                          take(index + 1),
                          reduce(
                            (accumulator_, current___, index_, array) =>
                              isNullish(array[index_ - 1]) ||
                              isDefined(prop(current___.$$, "chord"))
                                ? accumulator_
                                : accumulator_ +
                                  (prop(
                                    array[index_ - 1]!.$$,
                                    "duration",
                                    "0",
                                    "_"
                                  ) as number) /
                                    measureAccumulator.division,
                            0
                          ),
                          add(
                            partAccumulator.timesignatures!.at(-1)!.numerator *
                              barId
                          )
                        ),
                        duration,
                      };
                      accumulator.notes.push(parameter);
                      return accumulator;
                    },
                    {
                      start:
                        partAccumulator.timesignatures!.at(-1)!.numerator *
                        barId,
                      notes: [] as Parameters<
                        typeof Sheet.Score.create
                      >[0]["tracks"][number]["notes"],
                    }
                  )
                )
              ),
              flatMap(prop("notes"))
            );

            partAccumulator.tracks[trackId]?.notes.push(...notes);

            const staves = times(
              attributes[0]?.$$?.staves?.[0]?._ ?? 1,
              (staveId) => {
                const staveNotes = notes
                  .flat()
                  .filter((note) => note.staveId === staveId);
                for (const note of staveNotes) note.staveId = staveId;
                return new Sheet.Stave({
                  id: staveId,
                  barId,
                  trackId,
                  clefs: attributes[0]?.$$?.clef?.filter(
                    (clef) => (clef.$?.number ?? 1) === staveId + 1
                  ),
                });
              }
            );
            partAccumulator.staves?.push(...staves);
            measureAccumulator.bars.push({ id: barId, trackId });
            return measureAccumulator;
          },
          {
            bars: [] as NonNullable<
              Parameters<typeof Sheet.Score.create>[0]["bars"]
            >,
            division: -1,
          }
        ) ?? { bars: [] };
        partAccumulator.bars?.push(...bars);
        return partAccumulator;
      },
      {
        bars: [],
        tracks: [],
        staves: [],
        timesignatures: [],
        keysignatures: [],
        tempos: [],
      } as Parameters<typeof Sheet.Score.create>[0]
    ) ?? {
      bars: [],
      tracks: [],
      staves: [],
      timesignatures: [],
      keysignatures: [],
      tempos: [],
    };
  const parameters = {
    name:
      this.mxl["score-partwise"].$$.work?.[0]?.$$?.["work-title"]?.[0]?._ ?? "",
    keysignatures,
    timesignatures,
    tempos,
    rows: [],
    staves,
    tracks,
    bars,
  };

  return Sheet.Score.create(parameters);
};
