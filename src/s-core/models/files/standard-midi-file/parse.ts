import * as Midi from ".";
export const parse = (arrayBuffer: ArrayBuffer): Midi.IMidi =>
  Midi.Parser.parse(new Uint8Array(arrayBuffer));
