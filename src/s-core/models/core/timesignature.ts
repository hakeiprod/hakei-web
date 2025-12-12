import * as Core from ".";
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
  serialize() {
    return {
      ...super.serialize(),
      denominator: this.denominator,
      numerator: this.numerator,
    };
  }
  export() {
    return this.serialize();
  }
  static import(data: ReturnType<Timesignature["export"]>) {
    return new Timesignature({
      ...data,
      start: new Core.Units.Beat(data.start),
      duration: new Core.Units.Beat(data.duration),
      end: new Core.Units.Beat(data.end),
    });
  }
}
