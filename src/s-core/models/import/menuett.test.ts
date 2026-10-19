// @vitest-environment node
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { convertScore } from "./convert";
import { extractMxl } from "./mxl";
import { convertMusicXml } from "./musicxml";
const original =
  "src/s-core/fixtures/files/musicxml/Menuett_in_G-Dur_BWV_Anh._114.mxl";
it("reads the actual Menuett via its explicit 3.0 DOCTYPE without changing the original", async () => {
  const bytes = await readFile(original);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(
    "2a4fb54e1229faa8d7268a804ab4f8c90f9704c544f1721e171be925c1d5ae1a",
  );
  const result = await convertScore({
    bytes,
    sourceName: "Menuett_in_G-Dur_BWV_Anh._114.mxl",
    options: { mode: "PRESERVE" },
  });
  expect(result.metadata.formatVersion).toBe("3.0");
  expect(result.candidate.tracks).toHaveLength(2);
  expect(result.candidate.notes).toHaveLength(208);
  const first = result.candidate.notes
    .filter((note) => note.trackId === 0)
    .slice(0, 5);
  expect(
    first.map((note) => [
      note.pitch,
      "start" in note ? note.start : note.onset,
      note.duration,
    ]),
  ).toEqual([
    [74, 0, 1],
    [67, 1, 0.5],
    [69, 1.5, 0.5],
    [71, 2, 0.5],
    [72, 2.5, 0.5],
  ]);
  expect(
    result.candidate.notes
      .filter((note) => note.trackId === 1)
      .slice(0, 4)
      .map((note) => [
        note.pitch,
        "start" in note ? note.start : note.onset,
        note.duration,
        note.voice,
      ]),
  ).toEqual([
    [59, 0, 2, 1],
    [62, 0, 2, 1],
    [57, 2, 1, 1],
    [55, 0, 2, 2],
  ]);
  expect(result.candidate.timesignatures[0]).toMatchObject({
    start: 0,
    numerator: 3,
    denominator: 4,
  });
  expect(result.candidate.keysignatures[0]).toMatchObject({
    start: 0,
    accidental: 1,
    tonality: 0,
  });
  expect(
    result.issues.filter((issue) => issue.code === "UNSUPPORTED_REPEAT"),
  ).toHaveLength(6);
  expect(
    result.issues.some(
      (issue) =>
        issue.code === "MUSICXML_VERSION_FROM_DOCTYPE" &&
        issue.severity === "INFO",
    ),
  ).toBe(true);
  expect(
    result.issues.some(
      (issue) => issue.code === "DEFAULT_TEMPO" && issue.severity === "WARNING",
    ),
  ).toBe(true);
  expect(result.canPractice).toBe(false);
  expect(result.canGame).toBe(false);
});
it("does not infer an absent source version without an unambiguous supported standard declaration", async () => {
  const xml = new TextDecoder().decode(
    await extractMxl(await readFile(original)),
  );
  for (const source of [
    xml.replace(/<!DOCTYPE[\s\S]*?>/, ""),
    xml.replace(
      /PUBLIC[\s\S]*?partwise.dtd"/,
      'SYSTEM "http://www.musicxml.org/dtds/partwise.dtd"',
    ),
    xml.replace("MusicXML 3.0 Partwise", "MusicXML 4.1 Partwise"),
  ]) {
    await expect(
      convertMusicXml(new TextEncoder().encode(source)),
    ).rejects.toThrow("UNSUPPORTED_MUSICXML_VERSION");
  }
  await expect(
    convertMusicXml(
      new TextEncoder().encode(
        xml.replace("<score-partwise>", '<score-partwise version="4.0">'),
      ),
    ),
  ).rejects.toThrow("INVALID_XML_DOCTYPE");
});
it.each(["2.0", "3.0", "3.1", "4.0"])(
  "limits declaration-based recovery to supported version %s",
  async (version) => {
    const originalXml = new TextDecoder().decode(
      await extractMxl(await readFile(original)),
    );
    const source = originalXml.replace(
      "MusicXML 3.0 Partwise",
      `MusicXML ${version} Partwise`,
    );
    const result = await convertMusicXml(new TextEncoder().encode(source));
    expect(result.formatVersion).toBe(version);
    expect(
      result.issues.some(
        (issue) => issue.code === "MUSICXML_VERSION_FROM_DOCTYPE",
      ),
    ).toBe(true);
  },
);
