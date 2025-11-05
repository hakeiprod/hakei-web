import { Decibel } from "./decibel";

export class Centibel {
  _centibelBrand!: never;
  constructor(public value: number) {}
  toDecibel() {
    return new Decibel(this.value / 100);
  }
}
