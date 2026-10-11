import * as Engraving from "./";
import * as Sheet from "../sheet";

export class Bar extends Sheet.Bar {
  declare score: Engraving.Score;
  override get staves() {
    return super.staves as Engraving.Stave[];
  }
  static import(data: ReturnType<Bar["export"]>) {
    return new Bar(super.import(data));
  }
}
