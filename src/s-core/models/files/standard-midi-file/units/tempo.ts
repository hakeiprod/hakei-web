import * as Core from "../../../core";
import { PositiveIntSchema } from "../../../validator";
import { ValueObject } from "../../../valueobject";
export class MidiTempo extends ValueObject<number> {
  toTempo() {
    return new Core.Units.Tempo(60_000_000 / this.value);
  }
  validate(value: typeof this.value) {
    return PositiveIntSchema.parse(value);
  }
}
