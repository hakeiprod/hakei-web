import {
  firstBy,
  isEmpty,
  length,
  map,
  pipe,
  prop,
  times,
  unique,
  when,
} from "remeda";
import MusicXML from "..";
import { StaffDetails } from "../../../../const/musicxml/4.0/musicxml";
import * as Core from "../../../core";
import * as Sheet from "../../../sheet";

declare module ".." {
  interface MusicXML {
    toSheet(): Sheet.Score;
  }
}
export const toSheet = function (this: MusicXML) {
  if (process.env.NODE_ENV === "development") console.log({ mxl: this });
  return Sheet.Score.import({
    name: this.name ?? "",
    rows: [],
    notes:
      this.scorePartwise.parts?.flatMap((part, trackId) =>
        part.notes.map((note, id) => ({
          id,
          trackId,
          staveId: note.staff - 1,
          chordId: note.chordId,
          beam: prop(note, "musicData", "data", "beam"),
          rest: note.rest,
          voice: note.voice,
          velocity: 102,
          pitch: note.pitch.toMidiNoteNumber().value,
          alter: prop(note, "musicData", "data", "pitch", 0, "alter", 0, "_"),
          stem: prop(note, "musicData", "data", "stem", 0),
          start: note.musicData.start,
          duration: note.musicData.duration,
          end: note.musicData.end,
        })),
      ) ?? [],
    tracks:
      this.scorePartwise.parts?.map((part, id) => ({
        id,
        name: part.scorePart?.partName ?? "",
        preset: 0,
        staffDetails: <StaffDetails>{ "staff-lines": [{ _: 5 }] },
        start: part.start,
        duration: part.end - part.start,
        end: part.end,
      })) ?? [],
    timesignatures:
      this.scorePartwise.parts?.[0].times.map((time) => ({
        denominator: time.denominator,
        numerator: time.numerator,
        start: time.start,
        duration: time.duration,
        end: time.end,
      })) ?? [],
    keysignatures:
      this.scorePartwise.parts?.[0].keys.map((key) => ({
        accidental: key.fifths ?? 0,
        tonality:
          key.mode === "minor"
            ? Core.Enums.Tonality.Minor
            : Core.Enums.Tonality.Major,
        start: key.start,
        duration: key.duration,
        end: key.end,
      })) ?? [],
    tempos: pipe(
      this.scorePartwise.parts?.[0].tempos ?? [],
      map((tempo) => ({
        value: tempo.tempo,
        start: tempo.start,
        duration: tempo.duration,
        end: tempo.end,
      })),
      when(isEmpty, () => [
        {
          value: 120,
          start: this.scorePartwise.start,
          end: this.scorePartwise.end,
          duration: this.scorePartwise.duration,
        },
      ]),
    ),
    masterbars:
      firstBy(this.scorePartwise.parts, [
        prop("measures"),
        "desc",
      ])?.measures.map((measure, id) => ({
        id,
        barline: {},
        start: measure.start,
        duration: measure.duration,
        end: measure.end,
      })) ?? [],
    bars: this.scorePartwise.parts.flatMap((part, trackId) =>
      part.measures.map((_, id) => ({ id, trackId })),
    ),
    staves: this.scorePartwise.parts.flatMap((part, trackId) =>
      part.measures.flatMap((measure, barId) =>
        times(measure.staveCount, (id) => ({
          id,
          barId,
          trackId,
          clefs: prop(measure, "data", "attributes", 0, "clef"),
        })),
      ),
    ),
    chords: pipe(
      this.scorePartwise.notes,
      map(prop("chordId")),
      unique(),
      length(),
      times((id) => ({ id })),
    ),
    slots: [],
    start: 0,
    duration: 0,
    end: 0,
  });
};
