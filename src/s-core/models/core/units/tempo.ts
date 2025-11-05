import { ValueObject } from "../../valueobject";

export class Tempo extends ValueObject<number> {
  protected validate(value: typeof this.value): number {
    return value;
  }
}
