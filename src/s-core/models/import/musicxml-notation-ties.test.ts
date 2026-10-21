import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";
import { convertScore } from "./convert";
const source = await readFile(
  "src/s-core/fixtures/notation/basic/notehead-quarter.musicxml",
  "utf8",
);
for (const version of ["2.0", "3.0", "3.1", "4.0"]) {
  test(`keeps visual ties separate in MusicXML ${version}`, async () => {
    const note = source.match(/<note>.*?<\/note>/)![0];
    const first = note.replace(
      "</note>",
      '<notations><tied type="start" number="2" placement="below"/></notations></note>',
    );
    const second = note.replace(
      "</note>",
      '<notations><tied type="stop" number="2"/></notations></note>',
    );
    const xml = source
      .replace('version="4.0"', `version="${version}"`)
      .replace(note, first + second);
    const result = await convertScore({
      bytes: new TextEncoder().encode(xml),
      sourceName: "tie.musicxml",
      options: { mode: "PRESERVE" },
    });
    expect(result.candidate.notes[0].visualTies).toEqual([
      { type: "start", number: 2, placement: "below" },
    ]);
    expect(result.candidate.notes[1].visualTies).toEqual([
      { type: "stop", number: 2 },
    ]);
    expect(result.candidate.notes[0].ties).toBeUndefined();
    expect(result.canPractice).toBe(true);
  });
}
