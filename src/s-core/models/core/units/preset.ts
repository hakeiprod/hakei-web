import { ValueObject } from "../../valueobject";
import GeneralMidi from "../../../const/general-midi.json";
export class Preset extends ValueObject<number> {
  toName() {
    return GeneralMidi.presets[this.value]!.name;
  }
  validate(value: typeof this.value) {
    return value;
  }
}
