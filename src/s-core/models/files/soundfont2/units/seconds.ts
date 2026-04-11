import { NumericValueObject } from "@/s-core/models/valueobject";

export class Seconds extends NumericValueObject<Seconds> {
  _secondsBrand!: never;
  constructor(public value: number) {
    super(value);
  }
  validate() {
    return this.value;
  }
  create(value: typeof this.value) {
    return new Seconds(value);
  }
}
