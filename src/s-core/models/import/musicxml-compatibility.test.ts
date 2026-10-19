// @vitest-environment node
import { readFile, readdir } from "node:fs/promises";
import { expect, it } from "vitest";
import { parseStringPromise, processors } from "xml2js";
import MusicXML from "../files/musicxml";
import { extractMxl } from "./mxl";
import { convertScore } from "./convert";
const directory = "src/s-core/fixtures/files/musicxml/";
const entries = await readdir(directory);
const files = entries.filter((n) => n.endsWith(".mxl")).toSorted();
it.each(files)("keeps legacy note semantics in %s", async (file) => {
  const bytes = await readFile(directory + file);
  const xml = await extractMxl(bytes);
  const parsed = await parseStringPromise(new TextDecoder().decode(xml), {
    explicitArray: true,
    explicitCharkey: true,
    explicitChildren: true,
    preserveChildrenOrder: true,
    valueProcessors: [processors.parseNumbers],
    attrValueProcessors: [processors.parseNumbers],
  });
  const legacy = new MusicXML(parsed).toSheet().export();
  const result = await convertScore({
    bytes,
    sourceName: file,
    options: { mode: "PRESERVE" },
  });
  const notes = result.candidate.notes.map((n) => [
    n.pitch,
    "start" in n ? n.start : n.onset,
    n.duration,
    n.rest,
  ]);
  expect(notes).toEqual(
    legacy.notes.map((n) => [n.pitch, n.start, n.duration, n.rest]),
  );
  expect(result.metadata.formatVersion).toBe(
    file === "Menuett_in_G-Dur_BWV_Anh._114.mxl" ? "3.0" : "4.0",
  );
});
