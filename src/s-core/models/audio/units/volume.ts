import { NonNegativeNumberSchema } from "../../validator";
import { NumericValueObject } from "../../valueobject";
import { Gain } from "./gain";

export class Volume extends NumericValueObject<Volume> {
  validate(value: typeof this.value) {
    NonNegativeNumberSchema.parse(value);
    return value;
  }
  create(value: typeof this.value) {
    return new Volume(value);
  }
  toGain() {
    return new Gain(this.value / 100);
  }
}
