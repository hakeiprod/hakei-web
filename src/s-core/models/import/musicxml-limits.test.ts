// @vitest-environment node
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { convertMusicXml } from "./musicxml";
const bytes = (s: string) => new TextEncoder().encode(s);
it("enforces exact note, score span and staff boundaries", async () => {
  const base = await readFile(
    "src/s-core/fixtures/import/quarter.musicxml",
    "utf8",
  );
  const note = base.match(/<note>[\s\S]*?<\/note>/)![0];
  const largest = await convertMusicXml(
    bytes(base.replace(note, note.repeat(10_000))),
  );
  expect(largest.candidate.notes).toHaveLength(10_000);
  await expect(
    convertMusicXml(bytes(base.replace(note, note.repeat(10_001)))),
  ).rejects.toThrow("NOTE_LIMIT");
  const longest = await convertMusicXml(
    bytes(base.replace("<duration>1</duration>", "<duration>40000</duration>")),
  );
  expect(longest.candidate.tracks[0]).toMatchObject({ end: 40_000 });
  await expect(
    convertMusicXml(
      bytes(
        base.replace("<duration>1</duration>", "<duration>40001</duration>"),
      ),
    ),
  ).rejects.toThrow("SCORE_SPAN_LIMIT");
  await expect(
    convertMusicXml(
      bytes(base.replace("</attributes>", "<staves>16</staves></attributes>")),
    ),
  ).resolves.toHaveProperty("candidate");
  await expect(
    convertMusicXml(
      bytes(base.replace("</attributes>", "<staves>17</staves></attributes>")),
    ),
  ).rejects.toThrow("INVALID_XML_STAVES");
}, 15_000);
