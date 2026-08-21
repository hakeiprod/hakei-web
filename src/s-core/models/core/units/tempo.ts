import { PositiveIntSchema } from "../../validator";
import { ValueObject } from "../../valueobject";

export class Tempo extends ValueObject<number> {
  validate(value: typeof this.value) {
    PositiveIntSchema.parse(value);
    return value;
  }
}
