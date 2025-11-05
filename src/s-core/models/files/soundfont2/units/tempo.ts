export class Tempo {
  _tempoBrand!: never;
  constructor(public value: number) {}
  toBpm() {
    return Math.floor(60_000_000 / this.value);
  }
}
