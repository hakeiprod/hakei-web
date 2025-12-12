import * as Core from "@/s-core/models/core";
import { Keyboard } from "../browser/keyboard";
import { MidiNoteNumber } from "../core/units";
export class MidiinputConnecter {
  constructor(keyboard: Keyboard) {
    navigator.requestMIDIAccess().then((midiAccess) => {
      for (const input of midiAccess.inputs.values()) {
        input.onmidimessage = (midiMessageEvent) => {
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
          } else if (command === 0x80 || (command === 0x90 && data2 === 0)) {
            keyboard.noteOff(note);
          }
        };
      }
    });
  }
}
