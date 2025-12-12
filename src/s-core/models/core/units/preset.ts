import GeneralMidi from "../../../const/general-midi.json";
import { ValueObject } from "../../valueobject";
export class Preset extends ValueObject<number> {
  toName() {
    return GeneralMidi.presets[this.value]!.name;
  }
  validate(value: typeof this.value) {
    return value;
  }
}
