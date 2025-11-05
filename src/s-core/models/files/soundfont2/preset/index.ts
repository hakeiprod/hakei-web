import { Generator } from "../generator";
import Instrument from "../instrument";
import Soundfont2 from "..";
import { Header } from "./header";
import { Bag } from "../bag";
import { create } from "./create";

export default class Preset {
  constructor(
    public soundfont2: Soundfont2,
    public presetNumber: number,
    public header: Header,
    public bags: Bag[],
    public globalGenerators: Generator[],
    public instruments: Instrument[]
  ) {}
  static create = create;
}
