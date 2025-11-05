/**
 * cent full scale
 */
export class Centfs {
  _centfsBrand!: never;
  constructor(public value: number) {}
  toSemitone() {
    return this.value / 100;
  }
}
