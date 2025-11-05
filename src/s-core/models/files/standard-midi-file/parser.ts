import * as R from "remeda";
import { Parser as BinaryParser } from "binary-parser";
import Metadata from "./metadata.json";

let previousStatusByte: { type: number; channel: number } | null = null;
const { metaEvents } = Metadata.mtrk;

const noteMidiEventParser = new BinaryParser().uint8("pitch").uint8("velocity");
const controllerMidiEventParser = new BinaryParser()
  .uint8("controller")
  .uint8("value");
const programChangeMidiEventParser = new BinaryParser().uint8("program");
// const channelPresserMidiEventParser = new BinaryParser().uint8("value");
const midiEventParser = new BinaryParser().choice({
  tag: "$parent.statusByte.type",
  choices: {
    8: noteMidiEventParser,
    9: noteMidiEventParser,
    10: noteMidiEventParser,
    11: controllerMidiEventParser,
    12: programChangeMidiEventParser,
  },
});
const metaEventParser = new BinaryParser()
  .uint8("type")
  .uint8("length")
  .choice({
    tag: "type",
    choices: {
      ...metaEventChoice("text", (p, n, l) => p.string(n, l)),
      ...metaEventChoice("copyright", (p, n, l) => p.string(n, l)),
      ...metaEventChoice("trackName", (p, n, l) => p.string(n, l)),
      ...metaEventChoice("instrumentName", (p, n, l) => p.string(n, l)),
      ...metaEventChoice("lyric", (p, n, l) => p.string(n, l)),
      ...metaEventChoice("marker", (p, n, l) => p.string(n, l)),
      ...metaEventChoice("deviceName", (p, n, l) => p.string(n, l)),
      ...metaEventChoice("endOfTrack", (p, n, l) => p.string(n, l)),
      ...metaEventChoice("tempo", (p, n, l) => p.bit24(n, l)),
      ...metaEventChoice("timeSignature", (p, n) =>
        p.nest(n, {
          type: new BinaryParser()
            .uint8("numerator")
            .uint8("denominator", { formatter: (item) => item ** 2 })
            .uint8("clock")
            .uint8("bb"),
        })
      ),
      ...metaEventChoice("keySignature", (p, n) =>
        p.nest(n, { type: new BinaryParser().int8("sf").uint8("mi") })
      ),
    },
    defaultChoice: new BinaryParser().buffer("buffer", { length: "length" }),
  });
const midiTrackEventParser = new BinaryParser()
  .array("deltaTime", {
    type: "uint8",
    readUntil: (item) => (item & 0x80) === 0,
    formatter: (item: Uint8Array) =>
      R.reduce(
        [...item],
        (accumulator, byte) => (accumulator << 7) | (byte & 0x7f),
        0
      ),
  })
  .saveOffset("statusByteOffset")
  .pointer("runningStatus", {
    type: new BinaryParser().bit1("flag").bit7("_"),
    offset: "statusByteOffset",
  })
  .nest("statusByte", {
    type: new BinaryParser().bit4("type").bit4("channel"),
    formatter: statusByteFormatter,
  })
  .seek(function (this: {
    statusByte: { type: number; channel: number };
    runningStatus: { flag: number };
  }) {
    if (this.statusByte.type === 15 && this.statusByte.channel === 15) return 0; //meta
    if (this.statusByte.type === 15 && [0, 7].includes(this.statusByte.channel))
      return 0; //sysex
    if (this.runningStatus.flag === 0) return -1; // running status midi
    return 0; //midi
  })
  .choice("event", {
    tag: function (this: { statusByte: { type: number; channel: number } }) {
      if (this.statusByte.type === 15 && this.statusByte.channel === 15)
        return 2; //meta
      if (
        this.statusByte.type === 15 &&
        [0, 7].includes(this.statusByte.channel)
      )
        return 1; //sysex
      return 0; //midi
    },
    choices: {
      0: midiEventParser,
      // 1: sysExParser,
      2: metaEventParser,
    },
  });
const midiHeaderChunk = new BinaryParser()
  .string("type", { length: Metadata.mthd.header.type.length })
  .uint32("length")
  .uint16("format")
  .uint16("trackCount")
  .uint16("resolution");
const midiTrackChunk = new BinaryParser()
  .string("type", {
    length: Metadata.mtrk.header.type.length,
  })
  .uint32("length")
  .array("events", { type: midiTrackEventParser, lengthInBytes: "length" });
export const Parser = new BinaryParser()
  .useContextVars()
  .nest("mthd", { type: midiHeaderChunk })
  .array("mtrks", { type: midiTrackChunk, readUntil: "eof" });

function metaEventChoice(
  metaEvent: keyof typeof metaEvents,
  parser: (
    parser: BinaryParser,
    name: string,
    length: { length: string }
  ) => BinaryParser
) {
  return {
    [metaEvents[metaEvent].type]: parser(
      new BinaryParser(),
      metaEvents[metaEvent].name,
      { length: "length" }
    ),
  };
}
export function statusByteFormatter(item: { type: number; channel: number }) {
  // meta
  if (item.type === 15 && item.channel === 15) return item;
  // sysEx
  if (15 === item.type && [0, 7].includes(item.channel)) return item;
  // runningstatus
  if ((item.type & 0x8) === 0) return previousStatusByte;
  // midi
  return (previousStatusByte = item);
}
