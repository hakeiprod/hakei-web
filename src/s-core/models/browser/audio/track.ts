import * as Audio from "../../audio";
import { Note } from "./note";

export class Track extends Audio.Track {
  gain;
  override get notes() {
    return super.notes as Note[];
  }
  constructor({
    gain,
    ...track
  }: { gain: GainNode } & ConstructorParameters<typeof Audio.Track>[0]) {
    super(track);
    this.gain = gain;
  }
}
