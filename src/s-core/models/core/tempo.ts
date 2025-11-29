import * as Core from "../core";

export class Tempo extends Core.Event {
  value;
  override get params() {
    return {
      ...super.params,
      value: this.value.value,
    };
  }
  constructor(
    tempo: { value: Core.Units.Tempo } & ConstructorParameters<
      typeof Core.Event
    >[0]
  ) {
    super(tempo);
    this.value = tempo.value;
  }
  serialize() {
    return {
      ...super.serialize(),
      value: this.value.value,
    };
  }
  export() {
    return this.serialize();
  }
  static import(data: ReturnType<Tempo["export"]>) {
    return new Tempo({
      ...data,
      value: new Core.Units.Tempo(data.value),
      start: new Core.Units.Beat(data.start),
      duration: new Core.Units.Beat(data.duration),
      end: new Core.Units.Beat(data.end),
    });
  }
}
