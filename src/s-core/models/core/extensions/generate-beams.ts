import type { Beam } from "../../../const/musicxml/4.0/musicxml";
import type { Timesignature } from "../timesignature";
import type { Note } from "../../sheet/note";

type SheetNote = ReturnType<Note["export"]>;
type Chord = { notes: SheetNote[]; start: number; end: number; levels: number };

function beamLevels(duration: number) {
  return duration > 0 && duration < 1
    ? Math.min(8, -Math.floor(Math.log2(duration)))
    : 0;
}

function connect(group: Chord[]) {
  if (group.length < 2) return;
  const pitches = group.flatMap((chord) =>
    chord.notes.map((note) => note.pitch),
  );
  const middleLine = group[0].notes[0].staveId === 1 ? 50 : 71;
  const direction =
    (Math.min(...pitches) + Math.max(...pitches)) / 2 <= middleLine
      ? "up"
      : "down";
  for (const [index, chord] of group.entries()) {
    const beams: Beam[] = [];
    for (let level = 1; level <= chord.levels; level++) {
      const previous = group[index - 1];
      const next = group[index + 1];
      const joinsPrevious = previous && previous.levels >= level;
      const joinsNext = next && next.levels >= level;
      let value: Beam["_"];
      if (joinsPrevious && joinsNext) value = "continue";
      else if (joinsPrevious) value = "end";
      else if (joinsNext) value = "begin";
      else
        value =
          next &&
          (!previous || next.start - chord.start < chord.start - previous.start)
            ? "forward hook"
            : "backward hook";
      // The generated MusicXML schema declares the numeric attribute as number & string.
      beams.push({ _: value, $: { number: level as number & string } });
    }
    for (const note of chord.notes) {
      note.beam = beams as NonNullable<SheetNote["beam"]>;
      note.stem = { _: direction };
    }
  }
}

function beatLengths({ numerator, denominator }: Timesignature) {
  const unit = 4 / denominator;
  if (denominator < 8) return Array.from({ length: numerator }, () => unit);
  // Compound meters use groups of three. Other eighth-note meters use pairs,
  // with a final group of three for odd meters (e.g. 5/8 = 2+3).
  if (numerator % 3 === 0)
    return Array.from({ length: numerator / 3 }, () => unit * 3);
  const groups: number[] = [];
  let remaining = numerator;
  while (remaining > 3) {
    groups.push(unit * 2);
    remaining -= 2;
  }
  groups.push(unit * remaining);
  return groups;
}

/** Generate MusicXML beams within beats, keeping each track, staff and voice separate. */
export function generateBeams(
  notes: SheetNote[],
  masterbars: { start: number; end: number }[],
  timesignatures: Timesignature[],
) {
  const chords = new Map<number, SheetNote[]>();
  for (const note of notes) {
    if (note.chordId === undefined) continue;
    const chord = chords.get(note.chordId) ?? [];
    chord.push(note);
    chords.set(note.chordId, chord);
  }
  const voices = new Map<string, Chord[]>();
  for (const chordNotes of chords.values()) {
    const first = chordNotes[0];
    const key = `${first.trackId}:${first.staveId}:${first.voice}`;
    const voice = voices.get(key) ?? [];
    voice.push({
      notes: chordNotes,
      start: first.start,
      end: Math.max(...chordNotes.map((note) => note.end)),
      levels: chordNotes.every(
        (note) => !note.rest && note.duration === first.duration,
      )
        ? beamLevels(first.duration)
        : 0,
    });
    voices.set(key, voice);
  }
  for (const bar of masterbars) {
    const signature = timesignatures.find(
      (value) => value.start.value <= bar.start && value.end.value > bar.start,
    );
    if (!signature) continue;
    const boundaries: number[] = [];
    let beatEnd = bar.start;
    for (const length of beatLengths(signature)) {
      beatEnd += length;
      boundaries.push(Math.min(beatEnd, bar.end));
    }
    for (const voice of voices.values()) {
      let group: Chord[] = [];
      let groupEnd = 0;
      const barChords = voice
        .filter((chord) => chord.start >= bar.start && chord.start < bar.end)
        .toSorted((a, b) => a.start - b.start);
      for (const chord of barChords) {
        const boundary = boundaries.find((end) => chord.start < end) ?? bar.end;
        const eligible = chord.levels > 0 && chord.end <= boundary;
        if (
          !eligible ||
          boundary !== groupEnd ||
          group.at(-1)?.end !== chord.start
        ) {
          connect(group);
          group = [];
        }
        if (eligible) {
          group.push(chord);
          groupEnd = boundary;
        }
      }
      connect(group);
    }
  }
}
