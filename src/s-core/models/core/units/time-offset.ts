import { z } from "zod";
import { NumericValueObject } from "../../valueobject";
const valueSchema = z.int();
export class TimeOffset extends NumericValueObject<TimeOffset> {
  declare readonly _timeOffsetBrand: never;
  validate(value: number) {
    return valueSchema.parse(value);
  }
  create(value: number) {
    return new TimeOffset(value);
  }
}
