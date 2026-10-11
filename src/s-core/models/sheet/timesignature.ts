import * as Core from "../core";
export class Timesignature extends Core.Timesignature {
  static import(data: ReturnType<Timesignature["export"]>) {
    return new Timesignature(super.import(data));
  }
}
