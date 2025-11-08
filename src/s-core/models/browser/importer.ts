import * as Core from "../core";
import * as Midi from "../files/standard-midi-file";
import { Zip } from "../files/zip";
import * as xml2js from "xml2js";
import * as MusicXml from "../files/musicxml";
import "../core/extensions/to-sheet";
import "../core/extensions/to-audio";
import "../files/musicxml/extensions/to-sheet";
import "../sheet/extensions/to-smufl";
import "../smufl/extensions/to_svg";
import { ScorePartwise } from "../../const/musicxml/4.0/musicxml";
import { parseNumbers } from "xml2js/lib/processors";

// ちゃんと書け
export class Importer {
  async import(file: File) {
    const reader = new FileReader();
    const extname = file.name.slice(file.name.lastIndexOf("."));
    if (file.type === "application/json") reader.readAsText(file);
    if (file.type === "audio/mid" || extname === ".mxl")
      reader.readAsArrayBuffer(file);
    await new Promise<void>((resolve) => (reader.onload = () => resolve()));
    if (file.type === "application/json") reader.readAsText(file, "ascii");
    if (reader.result instanceof ArrayBuffer) {
      if (file.type === "audio/mid")
        return Midi.toCore(Midi.parse(await file.arrayBuffer())).toSheet();
      if (extname === ".mxl") {
        const zip = await new Zip(await file.arrayBuffer()).unzip();
        const meta = await zip.files["META-INF/container.xml"]?.async("text");
        if (!meta) return;
        const rootfile = new DOMParser()
          .parseFromString(meta, "application/xml")
          .querySelectorAll("rootfile")[0];
        const pathName = rootfile?.getAttribute("full-path");
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
    }
    if (typeof reader.result === "string" && extname === ".json") {
      return Core.Score.create(JSON.parse(reader.result)).toSheet();
    }
  }
}
