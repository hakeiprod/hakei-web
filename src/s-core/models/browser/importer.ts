import * as xml2js from "xml2js";
import { parseNumbers } from "xml2js/lib/processors";
import { ScorePartwise } from "../../const/musicxml/4.0/musicxml";
import * as Core from "../core";
import "../core/extensions/to-sheet";
import MusicXml from "../files/musicxml";
import "../files/musicxml/extensions/to-sheet";
import * as Midi from "../files/standard-midi-file";
import { Zip } from "../files/zip";
import "../smufl/extensions/to-svg";

export class Importer {
  async import(file: File) {
    const extname = file.name.slice(file.name.lastIndexOf("."));
    if (file.type === "audio/mid")
      return Midi.toCore(Midi.parse(await file.arrayBuffer())).toSheet();
    else if (extname === ".mxl") {
      const zip = await new Zip(await file.arrayBuffer()).unzip();
      const meta = await zip.files["META-INF/container.xml"]?.async("text");
      if (!meta) throw new Error("Invalid Musicxml");
      const parsed = await xml2js.parseStringPromise(meta);
      const { rootfile } = parsed.container.rootfiles[0];
      const pathName = rootfile[0].$["full-path"];
      if (!pathName) throw new Error("Invalid Musicxml");
      const data = await zip.files[pathName]?.async("text");
      if (!data) throw new Error("Invalid Musicxml");
      return new MusicXml(
        (await new xml2js.Parser({
          explicitArray: true,
          explicitCharkey: true,
          explicitChildren: true,
          preserveChildrenOrder: true,
          valueProcessors: [parseNumbers],
          attrValueProcessors: [parseNumbers],
        }).parseStringPromise(data)) as {
          ["score-partwise"]: ScorePartwise[number];
        },
      ).toSheet();
    } else if (extname === ".json")
      return Core.Score.create(JSON.parse(await file.text())).toSheet();
    else {
      throw new Error("Invalid file type");
    }
  }
}
