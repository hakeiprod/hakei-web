import * as Core from "../core";
export class Keysignature extends Core.Keysignature {
  static import(data: ReturnType<Keysignature["export"]>) {
    return new Keysignature(super.import(data));
  }
}
