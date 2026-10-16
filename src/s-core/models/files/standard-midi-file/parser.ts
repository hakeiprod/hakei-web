import { parseMidi, type MidiEvent as LibraryEvent } from "midi-file";
import type { IMidi, MidiTrackEvent, MetaEvent } from ".";
/** Validate byte boundaries before asking the established codec to decode events. */
function validateTrack(bytes: Uint8Array) {
  let cursor = 0,
    running: number | undefined;
  const lengths: number[] = [];
  function byte() {
    if (cursor >= bytes.length) throw new Error("INVALID_MIDI");
    return bytes[cursor++];
  }
  function variable() {
    let value = 0;
    for (let count = 0; count < 4; count++) {
      const part = byte();
      value = value * 128 + (part & 127);
      if (part < 128) return value;
    }
    throw new Error("INVALID_MIDI");
  }
  while (cursor < bytes.length) {
    variable();
    let status = byte();
    if (status < 128) {
      if (running === undefined) throw new Error("INVALID_MIDI_RUNNING_STATUS");
      cursor--;
      status = running;
    }
    if (status >= 128 && status < 240) {
      running = status;
      const count = status >> 4 === 12 || status >> 4 === 13 ? 1 : 2;
      for (let index = 0; index < count; index++)
        if (byte() >= 128) throw new Error("INVALID_MIDI_DATA");
      lengths.push(count);
    } else if (status === 255 || status === 240 || status === 247) {
      running = undefined;
      if (status === 255) byte();
      const length = variable();
      if (length > bytes.length - cursor)
        throw new Error("INVALID_MIDI_LENGTH");
      cursor += length;
      lengths.push(length);
    } else throw new Error("INVALID_MIDI_STATUS");
  }
  return lengths;
}
function event(source: LibraryEvent, length: number): MidiTrackEvent {
  if (!Number.isSafeInteger(source.deltaTime) || source.deltaTime < 0)
    throw new Error("INVALID_MIDI_TIME");
  const channel =
    "channel" in source
      ? source.channel
      : source.type === "sysEx"
        ? 0
        : source.type === "endSysEx"
          ? 7
          : 15;
  const wrap = (
    type: number,
    data: MidiTrackEvent["event"],
  ): MidiTrackEvent => ({
    deltaTime: source.deltaTime,
    statusByte: { type, channel },
    event: data,
  });
  switch (source.type) {
    case "noteOn": {
      return wrap(9, {
        kind: source.type,
        pitch: source.noteNumber,
        velocity: source.velocity,
      });
    }
    case "noteOff": {
      return wrap(8, {
        kind: source.type,
        pitch: source.noteNumber,
        velocity: source.velocity,
      });
    }
    case "controller": {
      return wrap(11, {
        kind: source.type,
        controller: source.controllerType,
        value: source.value,
      });
    }
    case "programChange": {
      return wrap(12, { kind: source.type, program: source.programNumber });
    }
    case "pitchBend": {
      return wrap(14, { kind: source.type, pitchBend: source.value });
    }
    case "noteAftertouch": {
      return wrap(10, {
        kind: source.type,
        pitch: source.noteNumber,
        pressure: source.amount,
      });
    }
    case "channelAftertouch": {
      return wrap(13, { kind: source.type, pressure: source.amount });
    }
    case "sysEx":
    case "endSysEx": {
      const raw: number[] = [];
      for (let index = 0; index < source.data.length; index++)
        raw.push(source.data[index]);
      return wrap(15, { kind: source.type, raw });
    }
    default: {
      const data: MetaEvent = { type: 0, length, kind: source.type };
      switch (source.type) {
        case "trackName": {
          data.trackName = source.text;
          data.type = 3;
          break;
        }
        case "instrumentName": {
          data.instrumentName = source.text;
          data.type = 4;
          break;
        }
        case "marker": {
          data.marker = source.text;
          data.type = 6;
          break;
        }
        case "endOfTrack": {
          data.endOfTrack = "";
          data.type = 47;
          break;
        }
        case "setTempo": {
          if (source.microsecondsPerBeat <= 0)
            throw new Error("INVALID_MIDI_TEMPO");
          data.tempo = source.microsecondsPerBeat;
          data.type = 81;
          break;
        }
        case "timeSignature": {
          if (
            source.numerator <= 0 ||
            !Number.isSafeInteger(source.denominator)
          )
            throw new Error("INVALID_MIDI_METER");
          data.timeSignature = {
            numerator: source.numerator,
            denominator: source.denominator,
            clock: source.metronome,
            bb: source.thirtyseconds,
          };
          data.type = 88;
          break;
        }
        case "keySignature": {
          if (
            source.key < -7 ||
            source.key > 7 ||
            ![0, 1].includes(source.scale)
          )
            throw new Error("INVALID_MIDI_KEY");
          data.keySignature = { sf: source.key, mi: source.scale as 0 | 1 };
          data.type = 89;
          break;
        }
      }
      return {
        deltaTime: source.deltaTime,
        statusByte: { type: 15, channel: 15 },
        event: data,
      };
    }
  }
}
export const Parser = {
  parse(bytes: Uint8Array): IMidi {
    if (bytes.length < 14) throw new Error("INVALID_MIDI_HEADER");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tag = (offset: number) =>
      String.fromCodePoint(...bytes.slice(offset, offset + 4));
    if (tag(0) !== "MThd") throw new Error("INVALID_MIDI_HEADER");
    const length = view.getUint32(4),
      format = view.getUint16(8),
      trackCount = view.getUint16(10),
      resolution = view.getUint16(12);
    if (length < 6 || length > bytes.length - 8 || trackCount < 1)
      throw new Error("INVALID_MIDI_HEADER");
    if (format > 1 || (resolution & 0x80_00) !== 0)
      throw new Error("UNSUPPORTED_FORMAT");
    if (resolution === 0 || (format === 0 && trackCount !== 1))
      throw new Error("INVALID_MIDI_HEADER");
    const trackLengths: number[][] = [];
    let cursor = 8 + length;
    for (let track = 0; track < trackCount; track++) {
      if (cursor + 8 > bytes.length || tag(cursor) !== "MTrk")
        throw new Error("INVALID_MIDI_CHUNK");
      const size = view.getUint32(cursor + 4);
      cursor += 8;
      if (size > bytes.length - cursor) throw new Error("INVALID_MIDI_LENGTH");
      trackLengths.push(validateTrack(bytes.subarray(cursor, cursor + size)));
      cursor += size;
    }
    if (cursor !== bytes.length) throw new Error("INVALID_MIDI_TRAILING_DATA");
    try {
      const decoded = parseMidi(bytes);
      return {
        mthd: { type: "MThd", length, format, trackCount, resolution },
        mtrks: decoded.tracks.map((track, index) => {
          if (track.length !== trackLengths[index].length)
            throw new Error("INVALID_MIDI_EVENTS");
          return {
            type: "MTrk",
            events: track.map((source, position) =>
              event(source, trackLengths[index][position]),
            ),
          };
        }),
      };
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error("INVALID_MIDI");
    }
  },
};
