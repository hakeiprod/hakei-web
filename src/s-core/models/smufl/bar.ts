import * as SMUFL from ".";
import * as Sheet from "../sheet";

export class Bar extends Sheet.Bar {
  declare score: SMUFL.Score;
  override get staves() {
    return super.staves as SMUFL.Stave[];
  }
  static import(data: ReturnType<Bar["export"]>) {
    return new Bar(super.import(data));
  }
}
