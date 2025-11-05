import Riff from ".";
import { Parser as BinaryParser } from "binary-parser";

const riffParser = new BinaryParser()
  .string("id", { length: 4 })
  .int32le("length")
  .choice({
    tag: function (this: { id: (typeof Riff.ID)[number] }) {
      return [Riff.ID].findIndex((ids) => ids.includes(this.id)) + 1 || -1;
    },
    choices: {
      1: new BinaryParser().string("data", { length: 4 }),
      2: new BinaryParser().string("data", { length: "length" }),
    },
    defaultChoice: new BinaryParser().buffer("data", { length: "length" }),
  });

export const Parser = new BinaryParser().array("chunks", {
  type: riffParser,
  readUntil: "eof",
});
