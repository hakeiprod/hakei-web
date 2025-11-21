import * as Audio from "../audio";
import { Keyboard } from "../browser/keyboard";
export class KeyboardHighlighter {
  constructor(public keyboard: Keyboard) {}
  noteOn(note: Audio.Note) {
    this.keyboard.noteOn(note);
  }
  noteOff(note: Audio.Note) {
    this.keyboard.noteOff(note);
  }
}
