import { Seconds } from "../../files/soundfont2/units/seconds";
import { NonNegativeNumberSchema } from "../../validator";
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
    NonNegativeNumberSchema.parse(value);
    return value;
  }
  create(value: typeof this.value) {
    return new Beat(value);
  }
}
