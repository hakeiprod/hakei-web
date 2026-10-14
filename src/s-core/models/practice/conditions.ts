import { TimeOffset } from "../core/units/time-offset";
import { practiceConditionsSchema, type PracticeConditions } from "./contracts";
export class Conditions {
  readonly calibration: TimeOffset;
  private constructor(private readonly data: PracticeConditions) {
    this.calibration = new TimeOffset(data.calibrationUs);
  }
  static import(input: unknown) {
    return new Conditions(practiceConditionsSchema.parse(input));
  }
  export() {
    return { ...this.data };
  }
}
