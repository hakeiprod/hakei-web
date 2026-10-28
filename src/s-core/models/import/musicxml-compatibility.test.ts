// @vitest-environment node
import { readFile, readdir } from "node:fs/promises";
import { expect, it } from "vitest";
import { parseStringPromise, processors } from "xml2js";
import MusicXML from "../files/musicxml";
import { extractMxl } from "./mxl";
import { convertScore } from "./convert";
import manifest from "../../fixtures/import/musicxml-compatibility.json";
const directory = "src/s-core/fixtures/files/musicxml/";
const entries = await readdir(directory);
it("accounts for every MXL with an explicit legacy or independent regression", () => {
  const registered = [...manifest.legacy, ...manifest.independent].map(
    (entry) => entry.file,
  );
  expect(new Set(registered).size).toBe(registered.length);
  expect(registered.toSorted()).toEqual(
    entries.filter((name) => name.endsWith(".mxl")).toSorted(),
  );
});
it.each(manifest.legacy)(
  "keeps legacy note semantics in $file",
  async ({ file, version }) => {
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
    expect(result.metadata.formatVersion).toBe(version);
  },
);
