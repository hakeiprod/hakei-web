import { isEmpty, isNonNullish, omit, reduce } from "remeda";
import * as Midi from "..";
import * as Core from "../../../core";

export const toCore = (data: Midi.IMidi) => {
  if (process.env.NODE_ENV === "development") console.log({ midi: data });
  const parameters = reduce(
    data.mtrks,
    (trackAccumulator, trackCurrent) => {
      const { notes, name } = reduce(
        trackCurrent.events,
        (accumulator, current) => {
          accumulator.time += Midi.calcDuration(
            current.deltaTime,
            data.mthd.resolution
          );
          if (Midi.isMetaEvent(current)) {
            if (isNonNullish(current.event.timeSignature))
              trackAccumulator.timesignatures?.push({
                ...omit(current.event.timeSignature, ["clock", "bb"]),
                start: accumulator.time,
              });
            if (isNonNullish(current.event.tempo))
              trackAccumulator.tempos?.push({
                value: new Midi.Unit.MidiTempo(current.event.tempo).toTempo()
                  .value,
                start: accumulator.time,
              });
            if (isNonNullish(current.event.keySignature))
              trackAccumulator.keysignatures?.push({
                tonality:
                  current.event.keySignature.mi === 0
                    ? Core.Enums.Tonality.Major
                    : Core.Enums.Tonality.Minor,
                accidental: current.event.keySignature.sf,
                start: accumulator.time,
              });
            if (
              isNonNullish(current.event.trackName) &&
              current.event.trackName
            )
              accumulator.name = current.event.trackName;
          }
          if (Midi.isNoteOffEvent(current)) {
            const note = accumulator.notes.findLast(
              (note) => note.pitch === current.event.pitch
            );
            if (note) note.end = accumulator.time;
          } else if (Midi.isNoteOnEvent(current))
            accumulator.notes.push({
              velocity: current.event.velocity,
              pitch: current.event.pitch,
              start: accumulator.time,
            });
          return accumulator;
        },
        { notes: [], time: 0 } as {
          notes: Parameters<
            typeof Core.Score.create
          >[0]["tracks"][number]["notes"];
          time: number;
          name?: string;
        }
      );
      if (isEmpty(notes)) return trackAccumulator;
      trackAccumulator.tracks.push({ notes, name });

      return trackAccumulator;
    },
    {
      tracks: [],
      keysignatures: [],
      timesignatures: [],
      tempos: [],
      name: undefined,
    } as Parameters<typeof Core.Score.create>[0]
  );

  return Core.Score.create(parameters);
};
