/**
 * 1 / 1000
 */
export class Promille {
  _promilleBrand!: never;
  constructor(public value: number) {}
  toNumber() {
    return this.value / 1000;
  }
}
