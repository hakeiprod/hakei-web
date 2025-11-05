import * as Core from "../core";
export class Timesignature extends Core.Event {
  denominator;
  numerator;
  get barCount() {
    return this.duration.value / this.numerator;
  }
  override get params() {
    return {
      ...super.params,
      denominator: this.denominator,
      numerator: this.numerator,
    };
  }
  constructor(
    timesignature: {
      denominator: number;
      numerator: number;
    } & ConstructorParameters<typeof Core.Event>[0]
  ) {
    const { denominator, numerator } = timesignature;
    super(timesignature);
    this.denominator = denominator;
    this.numerator = numerator;
  }
}
