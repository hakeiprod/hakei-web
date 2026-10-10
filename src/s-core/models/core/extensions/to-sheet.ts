import { match } from "ts-pattern";
import { Clef, StaffDetails, Stem } from "../../../const/musicxml/4.0/musicxml";
import * as Core from "../../core";
import * as Sheet from "../../sheet";
import { generateBeams } from "./generate-beams";

declare module "../../core" {
  interface Score {
    toSheet(): Sheet.Score;
  }
}

Core.Score.prototype.toSheet = function (this: Core.Score) {
  const notes = this.notes.map((note) => ({
    ...note.export(),
    stem: undefined as Stem | undefined,
    voice: 1,
    chordId: undefined as number | undefined,
    rest: false,
    beam: undefined as Sheet.Note["beam"],
    alter: undefined,
    staveId: match(note.track.preset.toName())
      .with("Acoustic Grand Piano", () =>
        note.pitch.value < Core.Units.MidiNoteNumber.MIDDLE_C ? 1 : 0,
      )
      .otherwise(() => 0),
  }));
  const notesByChord = new Map<string, typeof notes>();
  for (const note of notes) {
    const key = `${note.trackId}:${note.staveId}:${note.start}`;
    const chordNotes = notesByChord.get(key) ?? [];
    chordNotes.push(note);
    notesByChord.set(key, chordNotes);
  }
  const chords: { id: number }[] = [];
  for (const chordNotes of notesByChord.values()) {
    const id = chords.length;
    chords.push({ id });
    const firstNote = chordNotes[0]!;
    const isBassStave =
      firstNote.staveId === 1 &&
      this.tracks
        .find((track) => track.id === firstNote.trackId)
        ?.preset.toName() === "Acoustic Grand Piano";
    const middleLinePitch = isBassStave ? 50 : 71;
    const centerPitch =
      (Math.min(...chordNotes.map((note) => note.pitch)) +
        Math.max(...chordNotes.map((note) => note.pitch))) /
      2;
    const stem = chordNotes.some((note) => note.duration < 4)
      ? {
          _:
            centerPitch <= middleLinePitch
              ? ("up" as const)
              : ("down" as const),
        }
      : undefined;
    for (const note of chordNotes) {
      note.chordId = id;
      note.stem = stem;
    }
  }
  const masterbars: {
    id: number;
    barline: Record<string, never>;
    start: number;
    duration: number;
    end: number;
  }[] = [];
  for (const [
    timesignatureIndex,
    timesignature,
  ] of this.timesignatures.entries()) {
    const beatsPerBar =
      (timesignature.numerator * 4) / timesignature.denominator;
    const start = timesignature.start.value;
    const end = timesignature.end.value;
    const isLastTimesignature =
      timesignatureIndex === this.timesignatures.length - 1;
    const barCount = isLastTimesignature
      ? Math.max(1, Math.ceil((end - start) / beatsPerBar))
      : Math.ceil((end - start) / beatsPerBar);
    for (let index = 0; index < barCount; index++) {
      const barStart = start + index * beatsPerBar;
      const duration =
        !isLastTimesignature && index === barCount - 1
          ? end - barStart
          : beatsPerBar;
      masterbars.push({
        id: masterbars.length,
        barline: {},
        start: barStart,
        duration,
        end: barStart + duration,
      });
    }
  }
  const staveIdsByTrack = new Map<number, Set<number>>();
  for (const note of notes) {
    const staveIds = staveIdsByTrack.get(note.trackId) ?? new Set<number>();
    staveIds.add(note.staveId);
    staveIdsByTrack.set(note.trackId, staveIds);
  }
  for (const track of this.tracks)
    if (!staveIdsByTrack.has(track.id))
      staveIdsByTrack.set(track.id, new Set([0]));

  // Core scores store sounding notes only. Fill the uncovered parts of each
  // staff and bar with Sheet rests so the notation layer can render silence.
  let restId = Math.max(-1, ...notes.map((note) => note.id)) + 1;
  const rests = masterbars.flatMap((masterbar) =>
    this.tracks.flatMap((track) =>
      [...(staveIdsByTrack.get(track.id) ?? [0])].flatMap((staveId) => {
        const intervals = notes
          .filter(
            (note) => note.trackId === track.id && note.staveId === staveId,
          )
          .filter(
            (note) => note.start < masterbar.end && note.end > masterbar.start,
          )
          .map((note) => ({
            start: Math.max(note.start, masterbar.start),
            end: Math.min(note.end, masterbar.end),
          }))
          .toSorted((a, b) => a.start - b.start);
        const gaps: { start: number; end: number }[] = [];
        let cursor = masterbar.start;
        for (const interval of intervals) {
          if (interval.start > cursor)
            gaps.push({ start: cursor, end: interval.start });
          cursor = Math.max(cursor, interval.end);
        }
        if (cursor < masterbar.end)
          gaps.push({ start: cursor, end: masterbar.end });
        return gaps.map(({ start, end }) => {
          const chordId = chords.length;
          chords.push({ id: chordId });
          return {
            id: restId++,
            trackId: track.id,
            staveId,
            chordId,
            stem: undefined as Stem | undefined,
            voice: 1,
            rest: true,
            beam: undefined,
            alter: undefined,
            pitch: 0,
            velocity: 0,
            start,
            duration: end - start,
            end,
          };
        });
      }),
    ),
  );

  const bars = masterbars.flatMap((masterbar) =>
    this.tracks.map((track) => ({ id: masterbar.id, trackId: track.id })),
  );
  const staves = bars.flatMap((bar) =>
    [...(staveIdsByTrack.get(bar.trackId) ?? [0])].map((id) => {
      const isBassStave =
        id === 1 &&
        this.tracks
          .find((track) => track.id === bar.trackId)
          ?.preset.toName() === "Acoustic Grand Piano";
      return {
        id,
        barId: bar.id,
        trackId: bar.trackId,
        clefs: <Clef[]>[
          {
            sign: [{ _: isBassStave ? "F" : "G" }],
            line: [{ _: isBassStave ? 4 : 2 }],
          },
        ],
      };
    }),
  );

  const sheetNotes = [...notes, ...rests].toSorted((a, b) => a.start - b.start);
  generateBeams(sheetNotes, masterbars, this.timesignatures);
  return Sheet.Score.import({
    ...this.export(),
    tracks: this.tracks.map((track) => ({
      ...track.export(),
      staffDetails: <StaffDetails>{ "staff-lines": [{ _: 5 }] },
    })),
    notes: sheetNotes,
    bars,
    staves,
    masterbars,
    chords,
    slots: [],
    rows: [],
  });
};
