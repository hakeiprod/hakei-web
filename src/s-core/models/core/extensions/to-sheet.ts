import { match } from "ts-pattern";
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

  return Sheet.Score.import({
    ...this.export(),
    tracks: this.tracks.map((track) => ({
      ...track.export(),
      staffDetails: { $$: { "staff-lines": [{ _: 5 }] } },
    })),
    notes,
    bars: [],
    staves: [],
    masterbars: [],
    chords,
    rows: [],
  });
};
