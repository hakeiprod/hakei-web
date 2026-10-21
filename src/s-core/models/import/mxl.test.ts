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

it("rejects missing root files, corrupted compression and encoded traversal", async () => {
  for (const path of ["missing.musicxml", "%2e%2e/score.xml"]) {
    const zip = new JSZip();
    zip.file("META-INF/container.xml", container(path));
    zip.file("score.xml", "x");
    await expect(
      extractMxl(await zip.generateAsync({ type: "uint8array" })),
    ).rejects.toThrow();
  }
  await expect(extractMxl(new Uint8Array([80, 75, 3, 4]))).rejects.toThrow(
    "INVALID_MXL_DIRECTORY",
  );
});

it("accepts the exact default expanded-byte budget and rejects one byte more", async () => {
  const xml = await readFile("src/s-core/fixtures/import/quarter.musicxml");
  const meta = container("score.xml");
  const unused =
    20 * 1024 * 1024 -
    xml.byteLength -
    new TextEncoder().encode(meta).byteLength;
  for (const extra of [0, 1]) {
    const zip = new JSZip();
    zip.file("META-INF/container.xml", meta);
    zip.file("score.xml", xml);
    zip.file("unused.bin", new Uint8Array(unused + extra));
    const archive = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
    });
    if (extra === 0)
      expect(await extractMxl(archive)).toEqual(new Uint8Array(xml));
    else await expect(extractMxl(archive)).rejects.toThrow("EXPANSION_LIMIT");
  }
}, 15_000);
it("accepts exactly 100 entries and rejects 101", async () => {
  const zip = new JSZip();
  const xml = await readFile("src/s-core/fixtures/import/quarter.musicxml");
  zip.file("META-INF/container.xml", container("score.xml"));
  zip.file("score.xml", xml);
  while (Object.keys(zip.files).length < 100)
    zip.file(`empty-${Object.keys(zip.files).length}`, "");
  expect(
    await extractMxl(await zip.generateAsync({ type: "uint8array" })),
  ).toEqual(new Uint8Array(xml));
  zip.file("one-more", "");
  await expect(
    extractMxl(await zip.generateAsync({ type: "uint8array" })),
  ).rejects.toThrow("ENTRY_LIMIT");
});
