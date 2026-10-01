import { match } from "ts-pattern";
import { Clef, StaffDetails } from "../../../const/musicxml/4.0/musicxml";
import * as Core from "../../core";
import * as Sheet from "../../sheet";

declare module "../../core" {
  interface Score {
    toSheet(): Sheet.Score;
  }
}

Core.Score.prototype.toSheet = function (this: Core.Score) {
  const notes = this.notes.map((note) => ({
    ...note.export(),
    stem: undefined,
    voice: 1,
    chordId: undefined as number | undefined,
    rest: false,
    beam: undefined,
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
    if (chordNotes.length < 2) continue;
    const id = chords.length;
    chords.push({ id });
    for (const note of chordNotes) note.chordId = id;
  }
  const masterbars: {
    id: number;
    barline: Record<string, never>;
    start: number;
    duration: number;
    end: number;
  }[] = [];
  let masterbarStart = 0;
  for (const timesignature of this.timesignatures) {
    const barCount = Math.ceil(
      timesignature.duration.value / timesignature.numerator,
    );
    for (let i = 0; i < barCount; i++) {
      const duration = timesignature.numerator;
      masterbars.push({
        id: masterbars.length,
        barline: {},
        start: masterbarStart,
        duration,
        end: masterbarStart + duration,
      });
      masterbarStart += duration;
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

  const bars = masterbars.flatMap((masterbar) =>
    this.tracks.map((track) => ({ id: masterbar.id, trackId: track.id })),
  );
  const staves = bars.flatMap((bar) =>
    [...(staveIdsByTrack.get(bar.trackId) ?? [0])].map((id) => {
      const isBassStave =
        id === 1 &&
        this.tracks.find((track) => track.id === bar.trackId)?.preset.toName() ===
        "Acoustic Grand Piano";
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

  return Sheet.Score.import({
    ...this.export(),
    tracks: this.tracks.map((track) => ({
      ...track.export(),
      staffDetails: <StaffDetails>{ "staff-lines": [{ _: 5 }] },
    })),
    notes,
    bars,
    staves,
    masterbars,
    chords,
    slots: [],
    rows: [],
  });
};
