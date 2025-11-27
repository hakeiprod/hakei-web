import * as Core from "@/s-core/models/core";
import { match } from "ts-pattern";
import { Keyboard } from "../browser/keyboard";
import { MidiNoteNumber } from "../core/units/midi-note-number";

export class KeyeventConnecter {
  constructor(public keyboard: Keyboard) {
    window.addEventListener("keydown", (e) => {
      this.keyboard.noteOn(
        new Core.Note({
          id: 0,
          trackId: 0,
          velocity: 100,
          pitch: new MidiNoteNumber(this.mapTo(e.key)),
        })
      );
    });
    window.addEventListener("keyup", (e) => {
      this.keyboard.noteOff(
        new Core.Note({
          id: 0,
          trackId: 0,
          velocity: 100,
          pitch: new MidiNoteNumber(this.mapTo(e.key)),
        })
      );
    });
  }
  mapTo(key: string) {
    return match(key)
      .with("z", () => 55)
      .with("s", () => 56)
      .with("x", () => 57)
      .with("d", () => 58)
      .with("c", () => 59)
      .with("v", () => 60)
      .with("g", () => 61)
      .with("b", () => 62)
      .with("h", () => 63)
      .with("n", () => 64)
      .with("m", () => 65)
      .with("k", () => 66)
      .with(",", () => 67)
      .with("l", () => 68)
      .with(".", () => 69)
      .with(";", () => 70)
      .with("/", () => 71)
      .with("\\", () => 72)
      .otherwise(() => -1);
  }
}
