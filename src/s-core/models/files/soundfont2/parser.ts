import { Parser as BinaryParser } from "binary-parser";
import Metadata from "./metadata.json";

export const headerParser = (lengthInBytes: number) =>
  new BinaryParser().array("data", {
    type: new BinaryParser()
      .endianness("little")
      .string("name", { length: 20, stripNull: true })
      .uint16("preset")
      .uint16("bank")
      .uint16("bagIndex")
      .uint32("library")
      .uint32("genre")
      .uint32("morphology"),
    lengthInBytes,
  });
export const sampleHeaderParser = (lengthInBytes: number) =>
  new BinaryParser().array("data", {
    type: new BinaryParser()
      .endianness("little")
      .string("name", { length: 20, stripNull: true })
      .uint32("start")
      .uint32("end")
      .uint32("startLoop")
      .uint32("endLoop")
      .uint32("sampleRate")
      .uint8("originalKey")
      .uint8("correction")
      .uint16("sampleLink")
      .uint16("type"),
    lengthInBytes,
  });
export const bagParser = (lengthInBytes: number) =>
  new BinaryParser().array("data", {
    type: new BinaryParser().uint16le("genIndex").uint16le("modIndex"),
    lengthInBytes,
  });
const modulatorSourceParser = new BinaryParser()
  .bit7("index")
  .bit1("cc")
  .bit1("direction")
  .bit1("polarity")
  .bit6("type");
export const modulatorParser = (lengthInBytes: number) =>
  new BinaryParser().array("data", {
    type: new BinaryParser()
      .nest("srcOper", { type: modulatorSourceParser })
      .uint16le("destOper")
      .int16le("modAmount")
      .nest("amtSrcOper", { type: modulatorSourceParser })
      .uint16le("modTransOper"),
    lengthInBytes,
  });
const rangesParser = BinaryParser.start().int8("lo").int8("hi");
const shAmountParser = BinaryParser.start().int16le("amount");
const wAmountParser = BinaryParser.start().uint16le("amount");
const findGenerator = (
  name: NonNullable<Metadata["generators"][number]>["name"]
) => Metadata["generators"].findIndex((generator) => generator?.name === name);
export const generatorParser = (lengthInBytes: number) =>
  new BinaryParser().array("data", {
    type: new BinaryParser().uint16le("genOper").choice("genAmount", {
      tag: "genOper",
      choices: {
        [findGenerator("sampleID")]: wAmountParser,
        [findGenerator("instrument")]: wAmountParser,
        [findGenerator("keyRange")]: rangesParser,
        [findGenerator("velRange")]: rangesParser,
      },
      defaultChoice: shAmountParser,
    }),
    lengthInBytes,
  });
export const instrumentParser = (lengthInBytes: number) =>
  new BinaryParser().array("data", {
    type: new BinaryParser()
      .string("name", { length: 20, stripNull: true })
      .uint16le("bagIndex"),
    lengthInBytes,
  });
