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

export abstract class NumericValueObject<
  T extends NumericValueObject<T>,
> extends ValueObject<number> {
  protected abstract validate(value: typeof this.value): typeof this.value;
  protected abstract create(value: typeof this.value): T;
  add(b: typeof this) {
    return this.create(this.value + b.value);
  }
  subtract(b: typeof this) {
    return this.create(this.value - b.value);
  }
}
