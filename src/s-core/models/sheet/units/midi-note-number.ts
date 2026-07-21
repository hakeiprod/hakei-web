import { Sign } from "@/s-core/const/musicxml/4.0/musicxml";
import { match, P } from "ts-pattern";
import { Units } from "../../core";

declare module "../../core/units" {
  interface MidiNoteNumber {
    toLine(sign: Sign): number;
  }
}

Units.MidiNoteNumber.prototype.toLine = function (sign: Sign) {
  return (
    match(sign._)
      .with("G", () => this.value - 60)
      .with("F", () => this.value - 40)
      .with(P.union("C", "TAB", "jianpu", "none", "percussion"), () => {
        throw new Error("wip");
      })
      .exhaustive() / 2
  );
};
