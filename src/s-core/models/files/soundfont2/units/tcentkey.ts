import { Centfs } from "./centfs";

/**
 * transepose cent per key
 */
export class TCentKey {
  _tcentkeyBrand!: never;
  constructor(public value: number) {}
  toSemitone() {
    return new Centfs(this.value).toSemitone();
  }
}
