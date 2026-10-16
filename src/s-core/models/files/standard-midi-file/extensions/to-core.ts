import * as Midi from "..";
import * as Core from "../../../core";
import { keyAccidentalSchema } from "../../../core/key-accidental";
function normalized<T extends { start?: number }>(items: T[] | undefined) {
  const byTime = new Map<number, T>();
  for (const item of items ?? []) byTime.set(item.start ?? 0, item);
  return [...byTime.values()].toSorted(
    (a, b) => (a.start ?? 0) - (b.start ?? 0),
  );
}
/** Extract in absolute ticks. Open notes are paired by track/channel/pitch, in onset order. */
export const toCore = (data: Midi.IMidi) => {
  const parameters: Parameters<typeof Core.Score.create>[0] = {
    tracks: [],
    keysignatures: [],
    timesignatures: [],
    tempos: [],
  };
  for (const [sourceTrack, track] of data.mtrks.entries()) {
    let ticks = 0,
      name = "",
      preset = 0;
    const notes: Parameters<
      typeof Core.Score.create
    >[0]["tracks"][number]["notes"] = [];
    const open = new Map<string, typeof notes>();
    for (const current of track.events) {
      ticks += current.deltaTime;
      if (!Number.isSafeInteger(ticks)) throw new Error("INVALID_MIDI_TIME");
      const time = ticks / data.mthd.resolution;
      if (Midi.isMetaEvent(current)) {
        if (current.event.timeSignature)
          parameters.timesignatures!.push({
            start: time,
            numerator: current.event.timeSignature.numerator,
            denominator: current.event.timeSignature.denominator,
          });
        if (current.event.tempo !== undefined)
          parameters.tempos!.push({
            start: time,
            value: new Midi.Unit.MidiTempo(current.event.tempo).toTempo().value,
          });
        if (current.event.keySignature)
          parameters.keysignatures!.push({
            start: time,
            accidental: keyAccidentalSchema.parse(
              current.event.keySignature.sf,
            ),
            tonality:
              current.event.keySignature.mi === 0
                ? Core.Enums.Tonality.Major
                : Core.Enums.Tonality.Minor,
          });
        if (current.event.trackName) name = current.event.trackName;
      } else if (
        current.statusByte.type === 12 &&
        "program" in current.event &&
        current.event.program !== undefined &&
        notes.length === 0
      )
        preset = current.event.program;
      if (Midi.isNoteOffEvent(current)) {
        const key = `${current.statusByte.channel}:${current.event.pitch}`;
        const pending = open.get(key);
        const note = pending?.shift();
        if (!note) throw new Error("MIDI_UNMATCHED_NOTE_OFF");
        if (time <= note.start!) throw new Error("MIDI_NONPOSITIVE_DURATION");
        note.end = time;
        note.duration = time - note.start!;
      } else if (Midi.isNoteOnEvent(current)) {
        const key = `${current.statusByte.channel}:${current.event.pitch}`;
        const note = {
          id: notes.length,
          pitch: current.event.pitch,
          velocity: current.event.velocity,
          start: time,
          channel: current.statusByte.channel,
        };
        notes.push(note);
        const pending = open.get(key) ?? [];
        pending.push(note);
        open.set(key, pending);
      }
    }
    if ([...open.values()].some((pending) => pending.length > 0))
      throw new Error("MIDI_UNCLOSED_NOTE");
    if (notes.length > 0)
      parameters.tracks.push({ name, preset, sourceTrack, notes });
  }
  parameters.tempos = normalized(parameters.tempos);
  parameters.timesignatures = normalized(parameters.timesignatures);
  parameters.keysignatures = normalized(parameters.keysignatures);
  return Core.Score.create(parameters);
};
