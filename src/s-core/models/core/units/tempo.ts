import { PositiveNumberSchema } from "../../validator";
import { ValueObject } from "../../valueobject";

export class Tempo extends ValueObject<number> {
  validate(value: typeof this.value) {
    PositiveNumberSchema.parse(value);
    return value;
  }
}
