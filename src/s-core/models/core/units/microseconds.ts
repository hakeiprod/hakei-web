import { z } from "zod";
import { NumericValueObject } from "../../valueobject";
import { TimeOffset } from "./time-offset";
const valueSchema = z.int().nonnegative();
export class Microseconds extends NumericValueObject<Microseconds> {
  declare readonly _microsecondsBrand: never;
  validate(value: number) {
    return valueSchema.parse(value);
  }
  create(value: number) {
    return new Microseconds(value);
  }
  difference(other: Microseconds) {
    return new TimeOffset(this.value - other.value);
  }
}
