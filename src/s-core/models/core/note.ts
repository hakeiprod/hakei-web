import * as Core from ".";

export class Note extends Core.Event {
  readonly id;
  trackId;
  pitch;
  velocity;
  score!: Core.Score;
  get tempo() {
    return this.score.tempos.find((tempo) => tempo.isOverlapped(this))!;
  }
  get keysignature() {
    return this.score.keysignatures.find((keysignature) =>
      keysignature.isOverlapped(this)
    )!;
  }
  get track() {
    return this.score.tracks.find((track) => track.id === this.trackId)!;
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
  serialize() {
    return {
      ...super.serialize(),
      id: this.id,
      trackId: this.trackId,
      pitch: this.pitch.value,
      velocity: this.velocity,
    };
  }
  export() {
    return this.serialize();
  }
  static import(data: ReturnType<Note["export"]>) {
    return new Note({
      ...data,
      pitch: new Core.Units.MidiNoteNumber(data.pitch),
      start: new Core.Units.Beat(data.start),
      duration: new Core.Units.Beat(data.duration),
      end: new Core.Units.Beat(data.end),
    });
  }
}
