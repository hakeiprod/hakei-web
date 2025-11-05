import { Seconds } from "./seconds";

export class Timecent {
  _timecentBrand!: never;
  constructor(public value: number) {}
  toSeconds() {
    return new Seconds(Math.pow(2, this.value / 1200));
  }
}
