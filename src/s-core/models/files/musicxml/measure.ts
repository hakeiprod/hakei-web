import { prop } from "remeda";
import { Part } from "./part";

export class Measure {
  get musicData() {
    return this.data.$$;
  }
  get attributes() {
    return prop(this.musicData, "attributes");
  }
  get division() {
    return;
  }
  constructor(
    public data: NonNullable<Part["data"]["$$"]["measure"]>[number],
    public part: Part,
  ) {}
}
