import { isStrictEqual } from "remeda";

export abstract class ValueObject<T> {
  readonly value: T;

  constructor(value: T) {
    this.value = this.validate(value);
  }
  protected abstract validate(value: typeof this.value): typeof this.value;
  equal(other: ValueObject<T>): boolean {
    return isStrictEqual(this.value, other.value);
  }
}
