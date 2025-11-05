import * as Core from "../../../core";
import { ValueObject } from "../../../valueobject";
export class MidiTempo extends ValueObject<number> {
  toTempo() {
    return new Core.Units.Tempo(Math.floor(60_000_000 / this.value));
  }
  validate(value: typeof this.value) {
    return value;
  }
}
