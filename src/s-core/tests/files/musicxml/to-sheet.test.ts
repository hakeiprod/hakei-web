import fs from "node:fs";
import { expect, test } from "vitest";
import { importCore } from "../..";
import * as xml2js from "xml2js";
import * as MusicXml from "../../../models/files/musicxml";
import { parseNumbers } from "xml2js/lib/processors";
import path from "node:path";
import { ScorePartwise } from "../../../const/musicxml/4.0/musicxml";
import JSZip from "jszip";

const importMusicXML = async (fileName: string) => {
  const arrayBuffer = fs.readFileSync(
    path.join(
      "src",
      "s-core",
      "fixtures",
      "files",
      "musicxml",
      `${fileName}.mxl`
    )
  );
  const zip = await new JSZip().loadAsync(arrayBuffer);
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
};

test("quarter_middle_c", async () =>
  expect(await importMusicXML("quarter_middle_c")).toEqual(
    (await importCore("quarter_middle_c")).toSheet()
  ));
test("8th_middle_c", async () =>
  expect(await importMusicXML("8th_middle_c")).toEqual(
    (await importCore("8th_middle_c")).toSheet()
  ));
test("beat_4", async () =>
  expect(await importMusicXML("beat_4")).toEqual(
    (await importCore("beat_4")).toSheet()
  ));
test("c_major_chord", async () =>
  expect(await importMusicXML("c_major_chord")).toEqual(
    (await importCore("c_major_chord")).toSheet()
  ));
