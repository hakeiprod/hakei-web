// @vitest-environment node
import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { extractMxl } from "./mxl";
const container = (path: string) =>
  `<container><rootfiles><rootfile full-path="${path}" media-type="application/vnd.recordare.musicxml+xml"/></rootfiles></container>`;
it("selects the MusicXML root rather than alternative PDF or audio", async () => {
  const zip = new JSZip();
  zip.file(
    "META-INF/container.xml",
    '<container><rootfiles><rootfile full-path="sheet.pdf" media-type="application/pdf"/><rootfile full-path="score.xml" media-type="application/vnd.recordare.musicxml+xml"/></rootfiles></container>',
  );
  const xml = await readFile("src/s-core/fixtures/import/quarter.musicxml");
  zip.file("score.xml", xml);
  zip.file("sheet.pdf", "PDF");
  expect(
    await extractMxl(await zip.generateAsync({ type: "uint8array" })),
  ).toEqual(new Uint8Array(xml));
});
it("rejects traversal and external root paths", async () => {
  for (const path of [
    "../score.xml",
    "/score.xml",
    "https://example.com/score.xml",
    String.raw`folder\score.xml`,
  ]) {
    const zip = new JSZip();
    zip.file("META-INF/container.xml", container(path));
    zip.file("score.xml", "x");
    await expect(
      extractMxl(await zip.generateAsync({ type: "uint8array" })),
    ).rejects.toThrow();
  }
});
it("counts all expanded entries including unused data against the total limit", async () => {
  const zip = new JSZip();
  zip.file("META-INF/container.xml", container("score.xml"));
  zip.file("score.xml", "x");
  zip.file("unused.bin", "a".repeat(4000));
  await expect(
    extractMxl(
      await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }),
      { maxExpandedBytes: 1024, maxEntries: 100 },
    ),
  ).rejects.toThrow("EXPANSION_LIMIT");
});
it("rejects too many entries before expansion", async () => {
  const zip = new JSZip();
  zip.file("META-INF/container.xml", container("score.xml"));
  zip.file("score.xml", "x");
  await expect(
    extractMxl(await zip.generateAsync({ type: "uint8array" }), {
      maxExpandedBytes: 1024,
      maxEntries: 1,
    }),
  ).rejects.toThrow("ENTRY_LIMIT");
});
it("recognizes an actual MusicXML root when optional media-type is absent", async () => {
  const zip = new JSZip();
  zip.file(
    "META-INF/container.xml",
    '<container><rootfiles><rootfile full-path="score.xml"/></rootfiles></container>',
  );
  const xml = await readFile("src/s-core/fixtures/import/quarter.musicxml");
  zip.file("score.xml", xml);
  expect(
    await extractMxl(await zip.generateAsync({ type: "uint8array" })),
  ).toEqual(new Uint8Array(xml));
});
