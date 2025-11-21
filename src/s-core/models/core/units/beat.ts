import { ValueObject } from "../../valueobject";
import { Tempo } from "./tempo";

export class Beat extends ValueObject<number> {
  add(b: Beat) {
    return new Beat(this.value + b.value);
  }
  subtract(b: Beat) {
    return new Beat(this.value - b.value);
  }
  toSeconds(tempo: Tempo) {
    return (60 * this.value) / tempo.value;
  }
  toMilliseconds(tempo: Tempo) {
    return this.toSeconds(tempo) * 1000;
  }
  validate(value: typeof this.value) {
    return value;
  }
}
