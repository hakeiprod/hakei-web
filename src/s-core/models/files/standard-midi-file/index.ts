import Metadata from "./metadata.json";
export * from "./extensions/to-core";
export * from "./parser";
export * from "./parse";
export * as Unit from "./units";
export interface IMidi {
  mthd: {
    type: string;
    length: number;
    format: number;
    trackCount: number;
    resolution: number;
  };
  mtrks: {
    type: string;
    events: MidiTrackEvent[];
  }[];
}
interface MidiTrackEvent<
  Event extends MetaEvent | MidiEvent = MetaEvent | MidiEvent,
> {
  statusByte: {
    type:
      | typeof Metadata.mtrk.metaEvent.type
      | typeof Metadata.mtrk.midiEvents.noteOn.type
      | typeof Metadata.mtrk.midiEvents.noteOff.type;
    channel: number;
  };
  deltaTime: number;
  event: Event;
}
interface MidiEvent {
  pitch: number;
  velocity: number;
}
interface MetaEvent extends Partial<MetaEvents> {
  length: number;
  type: number;
}
interface MetaEvents {
  trackName: string;
  instrumentName: string;
  marker: string;
  deviceName: string;
  endOfTrack: string;
  tempo: number;
  timeSignature: {
    numerator: number;
    denominator: number;
    clock: number;
    bb: number;
  };
  keySignature: {
    sf: number;
    mi: 0 | 1;
  };
}

export const calcDuration = (deltaTime: number, resolution: number) =>
  deltaTime / resolution;
export const isMetaEvent = (
  event: MidiTrackEvent
): event is MidiTrackEvent<MetaEvent> =>
  event.statusByte.type === Metadata.mtrk.metaEvent.type &&
  event.statusByte.channel === 15;
export const isNoteOffEvent = (
  event: MidiTrackEvent
): event is MidiTrackEvent<MidiEvent> =>
  event.statusByte.type === Metadata.mtrk.midiEvents.noteOff.type ||
  (isNoteOnEvent(event) && event.event.velocity === 0);
export const isNoteOnEvent = (
  event: MidiTrackEvent
): event is MidiTrackEvent<MidiEvent> =>
  event.statusByte.type === Metadata.mtrk.midiEvents.noteOn.type;
