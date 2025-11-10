import * as Core from "../core";

export class Note extends Core.Event {
  readonly id;
  trackId;
  pitch;
  velocity;
  override get params() {
    return {
      ...super.params,
      id: this.id,
      trackId: this.trackId,
      pitch: this.pitch.value,
      velocity: this.velocity,
    };
  }
  constructor(
    note: {
      id: number;
      trackId: number;
      velocity: number;
      pitch: Core.Units.MidiNoteNumber;
    } & ConstructorParameters<typeof Core.Event>[0]
  ) {
    const { id, trackId, pitch, velocity } = note;
    super(note);
    this.id = id;
    this.trackId = trackId;
    this.pitch = pitch;
    this.velocity = velocity;
  }
}
