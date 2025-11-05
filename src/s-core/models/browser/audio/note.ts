import * as Audio from "../../audio";
import * as BrowserAudio from ".";
export class Note extends Audio.Note {
  declare score: BrowserAudio.Score;
  synth;
  constructor({
    synth,
    ...note
  }: { synth: BrowserAudio.Synth } & ConstructorParameters<
    typeof Audio.Note
  >[0]) {
    super(note);
    this.synth = synth;
  }
}
