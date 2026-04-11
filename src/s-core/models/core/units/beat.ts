import { Seconds } from "../../files/soundfont2/units/seconds";
import { NumericValueObject } from "../../valueobject";
import { Tempo } from "./tempo";

export class Beat extends NumericValueObject<Beat> {
  toSeconds(tempo: Tempo) {
    return new Seconds((60 * this.value) / tempo.value);
  }
  toMilliseconds(tempo: Tempo) {
    return this.toSeconds(tempo).value * 1000;
  }
  validate(value: typeof this.value) {
    return value;
  }
  create(value: typeof this.value) {
    return new Beat(value);
  }
}
