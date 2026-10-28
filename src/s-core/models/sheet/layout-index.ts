import { firstBy, prop } from "remeda";
import type * as Sheet from ".";
import { Event } from "../core/event";
import { drainSteps } from "./render-steps";

const barKey = (track: number, bar: number) => `${track}/${bar}`;
const staveKey = (track: number, bar: number, stave: number) =>
  `${track}/${bar}/${stave}`;

/** Relationships belong to one complete score graph; no geometry is cached here. */
export class LayoutIndex {
  readonly notesByChordId = new Map<number, Sheet.Note[]>();
  readonly chordById = new Map<number, Sheet.Chord>();
  readonly trackById = new Map<number, Sheet.Track>();
  readonly masterbarById = new Map<number, Sheet.Masterbar>();
  readonly noteTrack = new Map<Sheet.Note, Sheet.Track>();
  readonly noteStave = new Map<Sheet.Note, Sheet.Stave>();
  readonly chordStave = new Map<Sheet.Chord, Sheet.Stave>();
  readonly chordTrack = new Map<Sheet.Chord, Sheet.Track>();
  readonly chordSlot = new Map<Sheet.Chord, Sheet.Slot>();
  readonly slotChords = new Map<Sheet.Slot, Sheet.Chord[]>();
  readonly staveBar = new Map<Sheet.Stave, Sheet.Bar>();
  readonly staveNotes = new Map<Sheet.Stave, Sheet.Note[]>();
  readonly staveChords = new Map<Sheet.Stave, Sheet.Chord[]>();
  readonly staveSlots = new Map<Sheet.Stave, Sheet.Slot[]>();
  readonly staveBeams = new Map<Sheet.Stave, Sheet.BeamGroup[]>();
  readonly chordBeams = new Map<Sheet.Chord, Sheet.BeamGroup[]>();
  readonly beamStave = new Map<Sheet.BeamGroup, Sheet.Stave>();
  readonly masterbarNotes = new Map<Sheet.Masterbar, Sheet.Note[]>();
  readonly masterbarChords = new Map<Sheet.Masterbar, Sheet.Chord[]>();
  readonly masterbarSlots = new Map<Sheet.Masterbar, Sheet.Slot[]>();
  readonly masterbarBars = new Map<Sheet.Masterbar, Sheet.Bar[]>();
  readonly barNotes = new Map<Sheet.Bar, Sheet.Note[]>();
  readonly barChords = new Map<Sheet.Bar, Sheet.Chord[]>();
  readonly barStaves = new Map<Sheet.Bar, Sheet.Stave[]>();
  readonly trackBars = new Map<Sheet.Track, Sheet.Bar[]>();

  constructor(
    readonly score: Sheet.Score,
    deferred = false,
  ) {
    if (!deferred) drainSteps(this.buildSteps());
  }

  static *createSteps(score: Sheet.Score) {
    const index = new LayoutIndex(score, true);
    yield* index.buildSteps();
    return index;
  }

  private *buildSteps() {
    const score = this.score;
    const append = <K, V>(map: Map<K, V[]>, key: K, value: V) => {
      const group = map.get(key);
      if (group) group.push(value);
      else map.set(key, [value]);
    };
    const unique = <K, V>(map: Map<K, V>, key: K, value: V, name: string) => {
      if (map.has(key)) throw new Error(`Duplicate ${name} identity`);
      map.set(key, value);
    };
    const bars = new Map<string, Sheet.Bar>(),
      staves = new Map<string, Sheet.Stave>();
    const staffCandidates = new Map<string, Sheet.Stave[]>();
    for (const track of score.tracks)
      unique(this.trackById, track.id, track, "track");
    for (const bar of score.masterbars)
      unique(this.masterbarById, bar.id, bar, "masterbar");
    for (const bar of score.bars) {
      unique(bars, barKey(bar.trackId, bar.id), bar, "bar");
      const track = this.trackById.get(bar.trackId);
      if (track) append(this.trackBars, track, bar);
      yield;
    }
    for (const stave of score.staves) {
      unique(
        staves,
        staveKey(stave.trackId, stave.barId, stave.id),
        stave,
        "stave",
      );
      const bar = bars.get(barKey(stave.trackId, stave.barId));
      if (bar) {
        this.staveBar.set(stave, bar);
        append(this.barStaves, bar, stave);
      }
      append(staffCandidates, `${stave.trackId}/${stave.id}`, stave);
      yield;
    }
    const noteIds = new Set<string>();
    for (const note of score.notes) {
      const identity = `${note.trackId}/${note.id}`;
      if (noteIds.has(identity)) throw new Error("Duplicate note identity");
      noteIds.add(identity);
      if (note.chordId !== undefined && note.chordId !== null)
        append(this.notesByChordId, note.chordId, note);
      const track = this.trackById.get(note.trackId);
      if (track) this.noteTrack.set(note, track);
      const candidates =
        staffCandidates.get(`${note.trackId}/${note.staveId}`) ?? [];
      const stave =
        candidates.find((stave) => {
          const bar = this.masterbarById.get(stave.barId);
          return (
            bar &&
            note.start.value >= bar.start.value &&
            note.start.value < bar.end.value
          );
        }) ?? candidates[0];
      if (stave) this.noteStave.set(note, stave);
      yield;
    }
    const chordEvents = new Map<Sheet.Chord, Event>();
    const chordsByBeat = new Map<number, Sheet.Chord[]>();
    for (const chord of score.chords) {
      unique(this.chordById, chord.id, chord, "chord");
      const notes = this.notesByChordId.get(chord.id);
      if (!notes?.length) throw new Error("Chord has no notes");
      // Keep the old Beat-object comparator, including its stable first choice.
      const start = firstBy(notes, prop("start"))!.start;
      const end = firstBy(notes, [prop("end"), "desc"])!.end;
      chordEvents.set(chord, new Event({ start, end }));
      append(chordsByBeat, start.value, chord);
      const stave = this.noteStave.get(notes[0]),
        track = this.noteTrack.get(notes[0]);
      if (stave) this.chordStave.set(chord, stave);
      if (track) this.chordTrack.set(chord, track);
      yield;
    }
    for (const slot of score.slots) {
      const chords = chordsByBeat.get(slot.beat.value) ?? [];
      this.slotChords.set(slot, chords);
      for (const chord of chords)
        if (!this.chordSlot.has(chord)) this.chordSlot.set(chord, slot);
      yield;
    }
    for (const bar of score.masterbars) {
      this.masterbarNotes.set(
        bar,
        score.notes.filter((note) => note.isOverlapped(bar)),
      );
      this.masterbarChords.set(
        bar,
        score.chords.filter((chord) =>
          chordEvents.get(chord)!.isOverlapped(bar),
        ),
      );
      this.masterbarSlots.set(
        bar,
        score.slots.filter((slot) => bar.isOverlapped(slot)),
      );
      this.masterbarBars.set(
        bar,
        score.bars.filter((part) => part.id === bar.id),
      );
      yield;
    }
    for (const bar of score.bars) {
      const masterbar = this.masterbarById.get(bar.id);
      this.barNotes.set(
        bar,
        ((masterbar && this.masterbarNotes.get(masterbar)) || []).filter(
          (note) => note.trackId === bar.trackId,
        ),
      );
      this.barChords.set(
        bar,
        ((masterbar && this.masterbarChords.get(masterbar)) || []).filter(
          (chord) => this.chordTrack.get(chord)?.id === bar.trackId,
        ),
      );
      yield;
    }
    for (const stave of score.staves) {
      const bar = this.staveBar.get(stave),
        masterbar = this.masterbarById.get(stave.barId);
      this.staveNotes.set(
        stave,
        ((bar && this.barNotes.get(bar)) || []).filter(
          (note) => note.staveId === stave.id,
        ),
      );
      this.staveChords.set(
        stave,
        ((bar && this.barChords.get(bar)) || []).filter(
          (chord) => this.chordStave.get(chord)?.id === stave.id,
        ),
      );
      this.staveSlots.set(
        stave,
        masterbar ? this.masterbarSlots.get(masterbar)! : [],
      );
      yield;
    }
    yield* this.populateBeamsSteps();
  }

  *populateBeamsSteps() {
    const score = this.score;
    this.staveBeams.clear();
    this.chordBeams.clear();
    this.beamStave.clear();
    const staves = new Map(
      score.staves.map((stave) => [
        staveKey(stave.trackId, stave.barId, stave.id),
        stave,
      ]),
    );
    const append = <K, V>(map: Map<K, V[]>, key: K, value: V) => {
      const group = map.get(key);
      if (group) group.push(value);
      else map.set(key, [value]);
    };
    for (const beam of score.beamGroups) {
      const stave = staves.get(
        staveKey(beam.trackId, beam.barId, beam.staveId),
      );
      if (stave) {
        this.beamStave.set(beam, stave);
        append(this.staveBeams, stave, beam);
      }
      // An ID repeated within a beam still describes one membership.
      for (const id of new Set(beam.chordIds)) {
        const chord = this.chordById.get(id);
        if (chord) append(this.chordBeams, chord, beam);
      }
      yield;
    }
  }
}
