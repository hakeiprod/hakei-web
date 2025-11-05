export class Decibel {
  _decibelBrand!: never;
  constructor(public value: number) {}
  toLinearVolume() {
    return Math.pow(10, this.value / 20);
  }
}
