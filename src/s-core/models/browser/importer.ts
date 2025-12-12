import * as Core from "../core";
import * as Midi from "../files/standard-midi-file";
import { Zip } from "../files/zip";
import * as xml2js from "xml2js";
import * as MusicXml from "../files/musicxml";
import "../core/extensions/to-sheet";
import "../files/musicxml/extensions/to-sheet";
import "../smufl/extensions/to-svg";
import { ScorePartwise } from "../../const/musicxml/4.0/musicxml";
import { parseNumbers } from "xml2js/lib/processors";

export class Importer {
  async import(file: File) {
    const extname = file.name.slice(file.name.lastIndexOf("."));
    if (file.type === "audio/mid")
      return Midi.toCore(Midi.parse(await file.arrayBuffer())).toSheet();
    if (extname === ".mxl") {
      const zip = await new Zip(await file.arrayBuffer()).unzip();
      const meta = await zip.files["META-INF/container.xml"]?.async("text");
      if (!meta) return;
      const parsed = await xml2js.parseStringPromise(meta);
      const { rootfile } = parsed.container.rootfiles[0];
      const pathName = rootfile[0].$["full-path"];
      if (!pathName) return;
      const data = await zip.files[pathName]?.async("text");
      if (!data) return;
      return new MusicXml.MXL(
        (await new xml2js.Parser({
          explicitArray: true,
          explicitCharkey: true,
          explicitChildren: true,
          valueProcessors: [parseNumbers],
          attrValueProcessors: [parseNumbers],
        }).parseStringPromise(data)) as {
          ["score-partwise"]: ScorePartwise[0];
        }
      ).toSheet();
    }
    if (extname === ".json")
      return Core.Score.create(JSON.parse(await file.text())).toSheet();
  }
}
