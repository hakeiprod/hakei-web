import { NonNegativeNumberSchema } from "../../validator";
import { NumericValueObject } from "../../valueobject";
import { Volume } from "./volume";

export class Gain extends NumericValueObject<Gain> {
  validate(value: typeof this.value) {
    NonNegativeNumberSchema.parse(value);
    return value;
  }
  create(value: typeof this.value) {
    return new Gain(value);
  }
  toVolume() {
    return new Volume(this.value * 100);
  }
}
