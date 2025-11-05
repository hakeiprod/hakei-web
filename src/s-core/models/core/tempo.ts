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
}
