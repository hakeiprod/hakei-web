// @vitest-environment node
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { convertMusicXml } from "./musicxml";
const base = () =>
  readFile("src/s-core/fixtures/import/quarter.musicxml", "utf8");
it("maps lexical voice labels independently while reserving numeric/default IDs", async () => {
  const original = await base();
  const note = original.match(/<note>[\s\S]*?<\/note>/)![0];
  const voices = ["01", "upper", "1", undefined, "0", "upper", "2", "lower"];
  const source = original.replace(
    note,
    voices
      .map((voice) =>
        note.replace(
          "<voice>1</voice>",
          voice === undefined ? "" : `<voice>${voice}</voice>`,
        ),
      )
      .join(""),
  );
  const result = await convertMusicXml(new TextEncoder().encode(source));
  const ids = result.candidate.notes.map((n) => n.voice);
  expect(ids[2]).toBe(1);
  expect(ids[3]).toBe(1);
  expect(ids[4]).toBe(0);
  expect(ids[6]).toBe(2);
  expect(ids[1]).toBe(ids[5]);
  expect(new Set([ids[0], ids[1], ids[2], ids[4], ids[6], ids[7]]).size).toBe(
    6,
  );
  expect(result.candidate.notes[0]).toMatchObject({
    pitch: 60,
    start: 0,
    duration: 1,
  });
});

it("does not share a voice allocation table between parts", async () => {
  const xml = await base();
  const part = xml.match(/<part id="P1">[\s\S]*?<\/part>/)![0];
  const note = part.match(/<note>[\s\S]*?<\/note>/)![0];
  const first = part.replace(
    note,
    note.replace("<voice>1</voice>", "<voice>upper</voice>"),
  );
  const second = part
    .replace('id="P1"', 'id="P2"')
    .replace(note, note.replace("<voice>1</voice>", "<voice>0</voice>"));
  const result = await convertMusicXml(
    new TextEncoder().encode(xml.replace(part, first + second)),
  );
  expect(result.candidate.notes.map((n) => [n.trackId, n.voice])).toEqual([
    [0, 0],
    [1, 0],
  ]);
});
