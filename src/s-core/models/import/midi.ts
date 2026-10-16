import * as Midi from "../files/standard-midi-file";
import { partialScoreSchema, type ConversionIssue } from "./contracts";
import { convertJson } from "./json";
import {
  quantizeMidiNotes,
  midiConversionOptionsSchema,
  type MidiConversionOptions,
} from "./quantize-midi";

export function convertMidi(
  bytes: Uint8Array,
  settings: MidiConversionOptions,
) {
  const options = midiConversionOptionsSchema.parse(settings);
  const data = Midi.Parser.parse(bytes);
  const issues: ConversionIssue[] = [];
  const notes: {
    id: string;
    trackId: number;
    pitch: number;
    onset: number;
    duration: number | null;
    velocity: number;
    channel: number;
    rest: boolean;
    onsetTicks: number;
    durationTicks: number | null;
  }[] = [];
  const tracks: { id: number; name: string; preset: number }[] = [];
  const tempos: { start: number; value: number }[] = [];
  const timesignatures: {
    start: number;
    numerator: number;
    denominator: number;
  }[] = [];
  const keysignatures: {
    start: number;
    accidental: number;
    tonality: 0 | 1;
  }[] = [];
  function issue(
    code: string,
    severity: "WARNING" | "BLOCKING",
    track: number,
    message: string,
    fieldPath?: string,
  ) {
    issues.push({
      id: `${code}:${track}:${issues.length}`,
      code,
      severity,
      status: "UNRESOLVED",
      track,
      message,
      ...(fieldPath ? { fieldPath } : {}),
    });
  }
  for (const [trackId, track] of data.mtrks.entries()) {
    let ticks = 0;
    const entry = { id: trackId, name: "", preset: 0 };
    const pending = new Map<string, typeof notes>();
    for (const event of track.events) {
      ticks += event.deltaTime;
      if (!Number.isSafeInteger(ticks)) throw new Error("INVALID_MIDI_TIME");
      const start = ticks / data.mthd.resolution;
      if (Midi.isMetaEvent(event)) {
        if (event.event.trackName !== undefined)
          entry.name = event.event.trackName;
        if (event.event.tempo !== undefined) {
          if (event.event.tempo <= 0) throw new Error("INVALID_MIDI_TEMPO");
          tempos.push({ start, value: 60_000_000 / event.event.tempo });
        }
        if (event.event.timeSignature)
          timesignatures.push({
            start,
            numerator: event.event.timeSignature.numerator,
            denominator: event.event.timeSignature.denominator,
          });
        if (event.event.keySignature)
          keysignatures.push({
            start,
            accidental: event.event.keySignature.sf,
            tonality: event.event.keySignature.mi,
          });
      } else if (
        event.statusByte.type === 12 &&
        "program" in event.event &&
        event.event.program !== undefined
      ) {
        if (
          notes.some((note) => note.trackId === trackId) &&
          entry.preset !== event.event.program
        )
          issue(
            "MIDI_PROGRAM_CHANGE",
            "WARNING",
            trackId,
            "曲中の楽器変更は保持できません。",
          );
        else entry.preset = event.event.program;
      } else if (
        event.statusByte.type === 14 &&
        "pitchBend" in event.event &&
        event.event.pitchBend !== 0
      ) {
        issue(
          "MIDI_PITCH_BEND",
          "BLOCKING",
          trackId,
          "ピッチベンドによる音高を表現できません。音高の確認が必要です。",
        );
      } else if (
        event.statusByte.type === 11 &&
        "controller" in event.event &&
        event.event.controller === 64 &&
        "value" in event.event &&
        (event.event.value ?? 0) >= 64
      ) {
        issue(
          "MIDI_SUSTAIN",
          "BLOCKING",
          trackId,
          "サステインによる音価の延長を表現できません。音価の確認が必要です。",
        );
      }
      if (Midi.isNoteOffEvent(event)) {
        const note = pending
          .get(`${event.statusByte.channel}:${event.event.pitch}`)
          ?.shift();
        if (!note) {
          issue(
            "MIDI_UNMATCHED_NOTE_OFF",
            "WARNING",
            trackId,
            "対応する打鍵がない離鍵を除外しました。",
          );
          continue;
        }
        if (ticks <= note.onsetTicks) {
          issue(
            "MIDI_NONPOSITIVE_DURATION",
            "BLOCKING",
            trackId,
            "音価を確定できない音があります。",
          );
          continue;
        }
        note.durationTicks = ticks - note.onsetTicks;
        note.duration = note.durationTicks / data.mthd.resolution;
      } else if (Midi.isNoteOnEvent(event)) {
        const key = `${event.statusByte.channel}:${event.event.pitch}`;
        const queue = pending.get(key) ?? [];
        if (queue.length > 0)
          issue(
            "MIDI_OVERLAPPING_SAME_PITCH",
            "BLOCKING",
            trackId,
            "同音の重複打鍵を先着順に対応付けました。音価の確認が必要です。",
          );
        if (notes.length >= 10_000) throw new Error("NOTE_LIMIT");
        const note = {
          id: String(notes.length),
          trackId,
          pitch: event.event.pitch,
          velocity: event.event.velocity,
          channel: event.statusByte.channel,
          onset: start,
          duration: null,
          rest: false,
          onsetTicks: ticks,
          durationTicks: null,
        };
        notes.push(note);
        queue.push(note);
        pending.set(key, queue);
      }
    }
    if (notes.some((note) => note.trackId === trackId)) tracks.push(entry);
    for (const queue of pending.values())
      for (const note of queue)
        issue(
          "MIDI_UNCLOSED_NOTE",
          "BLOCKING",
          trackId,
          "離鍵がなく音価が不明です。",
          `notes.${notes.indexOf(note)}.duration`,
        );
  }
  if (notes.length === 0) throw new Error("EMPTY_SCORE");
  function normalize<T extends { start: number }>(
    events: T[],
    code: string,
    fallback: T,
    key: string,
  ) {
    const byTime = new Map<number, T>();
    for (const event of events) {
      const previous = byTime.get(event.start);
      if (previous && JSON.stringify(previous) !== JSON.stringify(event))
        issue(code, "BLOCKING", 0, "同じ時刻の演奏設定が競合しています。");
      byTime.set(event.start, event);
    }
    if (!byTime.has(0)) {
      byTime.set(0, fallback);
      issues.push({
        id: `default:${key}`,
        code: `DEFAULT_${key.toUpperCase()}`,
        severity: "WARNING",
        status: "UNRESOLVED",
        message: `開始位置の演奏設定を補完しました: ${JSON.stringify(fallback)}`,
      });
    }
    const ordered = [...byTime.values()].toSorted((a, b) => a.start - b.start);
    return ordered;
  }
  const normalized = {
    tempos: normalize(
      tempos,
      "MIDI_TEMPO_CONFLICT",
      { start: 0, value: 120 },
      "tempos",
    ),
    timesignatures: normalize(
      timesignatures,
      "MIDI_METER_CONFLICT",
      { start: 0, numerator: 4, denominator: 4 },
      "timesignatures",
    ),
    keysignatures: normalize(
      keysignatures,
      "MIDI_KEY_CONFLICT",
      { start: 0, accidental: 0, tonality: 0 },
      "keysignatures",
    ),
  };
  const completeNotes = notes.filter((note) => note.durationTicks !== null);
  const quantized = quantizeMidiNotes(
    completeNotes.map((note) => ({
      id: note.id,
      onsetTicks: note.onsetTicks,
      durationTicks: note.durationTicks!,
    })),
    data.mthd.resolution,
    options,
  );
  const adjusted = new Map(quantized.notes.map((note) => [note.id, note]));
  for (const warning of quantized.issues) {
    const note = notes.find((note) => note.id === warning.noteId)!;
    issue(
      warning.code,
      "WARNING",
      note.trackId,
      "整列により音価が0になるため、選択したグリッド1個分に補正しました。",
    );
  }
  const outputNotes = notes.map((original) => {
    const change = adjusted.get(original.id);
    return {
      id: original.id,
      trackId: original.trackId,
      pitch: original.pitch,
      velocity: original.velocity,
      channel: original.channel,
      rest: original.rest,
      onset: change?.onset ?? original.onset,
      duration: change?.duration ?? original.duration,
    };
  });
  if (outputNotes.some((note) => note.duration === null)) {
    const candidate = partialScoreSchema.parse({
      format: "converted-partial-v1",
      tracks,
      notes: outputNotes,
      ...normalized,
    });
    return {
      candidate,
      issues,
      changedNoteCount: quantized.changedNoteCount,
      changes: quantized.changes,
    };
  }
  const converted = convertJson({
    ...normalized,
    tracks: tracks.map((track) => ({
      name: track.name,
      preset: track.preset,
      sourceTrack: track.id,
      notes: outputNotes
        .filter((note) => note.trackId === track.id)
        .map((note) => ({
          id: Number(note.id),
          pitch: note.pitch,
          velocity: note.velocity,
          channel: note.channel,
          start: note.onset,
          duration: note.duration!,
        })),
    })),
  });
  issues.push(...converted.issues, {
    id: "midi:notation",
    code: "MIDI_NOTATION_INFERRED",
    severity: "WARNING",
    status: "UNRESOLVED",
    message: "MIDIに記譜情報がないため、音の綴り・譜表・休符を補完しました。",
  });
  return {
    candidate: converted.candidate,
    issues,
    changedNoteCount: quantized.changedNoteCount,
    changes: quantized.changes,
  };
}
