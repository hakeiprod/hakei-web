import { Generator } from "../generator";
import Instrument from "../instrument";

import { Modulator } from "../modulator";
import { Header } from "./header";

import { Generators, create } from "./create";

export class Sample {
  get start() {
    return (
      32_768 * this.generators.startAddrsCoarseOffset.value +
      this.header.start +
      this.generators.startAddrsOffset.value
    );
  }
  get end() {
    return (
      32_768 * this.generators.endAddrsCoarseOffset.value +
      this.header.end +
      this.generators.endAddrsOffset.value
    );
  }
  get startLoop() {
    return (
      32_768 * this.generators.startloopAddrsCoarseOffset.value +
      this.header.startLoop +
      this.generators.startloopAddrsOffset.value
    );
  }
  get endLoop() {
    return (
      32_768 * this.generators.endloopAddrsCoarseOffset.value +
      this.header.endLoop +
      this.generators.endloopAddrsOffset.value
    );
  }
  get baseDetune() {
    return (
      100 * this.header.originalKey +
      this.header.correction.value -
      this.generators.fineTune.value
    );
  }
  playBackRate(pitch: number) {
    return 1 * Math.pow(2, (pitch * 100 - this.baseDetune) / 1200);
  }
  constructor(
    public instrument: Instrument,
    public instrumentGenerators: Generator[],
    public instrumentModulators: Modulator[],
    public header: Header,
    public generators: Generators,
    public data: Int16Array
  ) {}
  static create = create;
}
