import * as Core from "@/s-core/models/core";
import type { Keyboard } from "../browser/keyboard";
import { MidiNoteNumber } from "../core/units/midi-note-number";

const keyPitches = new Map<string, number>([
  ["z", 55],
  ["s", 56],
  ["x", 57],
  ["d", 58],
  ["c", 59],
  ["v", 60],
  ["g", 61],
  ["b", 62],
  ["h", 63],
  ["n", 64],
  ["m", 65],
  ["k", 66],
  [",", 67],
  ["l", 68],
  [".", 69],
  [";", 70],
  ["/", 71],
  ["\\", 72],
]);

export class KeyeventConnecter {
  private abort = new AbortController();
  private handleKeyDown = (event: KeyboardEvent) => {
    const note = this.noteForKey(event.key);
    if (note) this.keyboard.noteOn(note);
  };
  private handleKeyUp = (event: KeyboardEvent) => {
    const note = this.noteForKey(event.key);
    if (note) this.keyboard.noteOff(note);
  };
  constructor(public keyboard: Keyboard) {
    globalThis.window.addEventListener("keydown", this.handleKeyDown, {
      signal: this.abort.signal,
    });
    globalThis.window.addEventListener("keyup", this.handleKeyUp, {
      signal: this.abort.signal,
    });
  }
  dispose() {
    this.abort.abort();
  }
  private noteForKey(key: string) {
    const pitch = this.mapTo(key);
    if (pitch === undefined) return;
    return new Core.Note({
      id: 0,
      trackId: 0,
      velocity: 100,
      pitch: new MidiNoteNumber(pitch),
    });
  }
  mapTo(key: string) {
    return keyPitches.get(key);
  }
}
