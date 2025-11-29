import * as Sheet from "../sheet";
import * as SMUFL from ".";

export class Bar extends Sheet.Bar {
  declare score: SMUFL.Score;
  override get staves() {
    return super.staves as SMUFL.Stave[];
  }
  static import(data: ReturnType<Bar["export"]>) {
    return new Bar(super.import(data));
  }
}
