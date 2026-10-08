import * as Core from "@/s-core/models/core";
import { Keyboard } from "../browser/keyboard";
import { MidiNoteNumber } from "../core/units";
export class MidiinputConnecter {
  private abort = new AbortController();
  constructor(keyboard: Keyboard) {
    if (!navigator.requestMIDIAccess) return;
    navigator
      .requestMIDIAccess()
      .then((midiAccess) => {
        if (this.abort.signal.aborted) return;
        for (const input of midiAccess.inputs.values()) {
          input.addEventListener(
            "midimessage",
            (midiMessageEvent) => {
              if (!midiMessageEvent.data) return;
              const status = midiMessageEvent.data[0];
              const data1 = midiMessageEvent.data[1];
              const data2 = midiMessageEvent.data[2];
              const command = status & 0xf0;
              const note = new Core.Note({
                id: 0,
                trackId: 0,
                velocity: data2,
                pitch: new MidiNoteNumber(data1),
              });
              if (command === 0x90 && data2 > 0) {
                keyboard.noteOn(note);
              } else if (
                command === 0x80 ||
                (command === 0x90 && data2 === 0)
              ) {
                keyboard.noteOff(note);
              }
            },
            { signal: this.abort.signal },
          );
        }
      })
      .catch((error: unknown) => {
        if (!this.abort.signal.aborted) console.error(error);
      });
  }
  dispose() {
    this.abort.abort();
  }
}
