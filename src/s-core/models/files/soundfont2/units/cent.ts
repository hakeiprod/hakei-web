import { Hertz } from "./hertz";

export class Cent {
  _centBrand!: never;
  constructor(public value: number) {}
  toHertz() {
    return new Hertz(8.176 * 2 ** (this.value / 1200));
  }
}
