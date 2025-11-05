import { Bag } from "../bag";
import { Generator } from "../generator";

import { Modulator } from "../modulator";

import { Sample } from "../sample";
import { Header } from "./header";
import { create } from "./create";
import Preset from "../preset";
export default class Instrument {
  constructor(
    public preset: Preset,
    public presetGenerators: Generator[],
    public presetModulators: Modulator[],
    public header: Header,
    public bags: Bag[],
    public globalGenerators: Generator[],
    public samples: Sample[]
  ) {}
  static create = create;
}
