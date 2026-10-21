import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";
import { convertScore } from "./convert";
const source = await readFile(
  "src/s-core/fixtures/notation/basic/notehead-quarter.musicxml",
  "utf8",
);
for (const version of ["2.0", "3.0", "3.1", "4.0"])
  test(`preserves spelling and explicit parentheses in MusicXML ${version}`, async () => {
    const xml = source
      .replace('version="4.0"', `version="${version}"`)
      .replace("<step>C</step>", "<step>D</step><alter>-1</alter>")
      .replace(
        "</type>",
        '</type><accidental cautionary="yes" parentheses="yes">flat</accidental>',
      );
    const result = await convertScore({
      bytes: new TextEncoder().encode(xml),
      sourceName: "flat.musicxml",
      options: { mode: "PRESERVE" },
    });
    expect(result.candidate.notes[0]).toMatchObject({
      pitch: 61,
      notatedPitch: { step: "D", alter: -1, octave: 4 },
      explicitAccidental: { kind: "flat", cautionary: true, parentheses: true },
    });
  });
test("does not rewrite sounding pitch for contradictory display metadata", async () => {
  const xml = source
    .replace("<step>C</step>", "<step>C</step><alter>1</alter>")
    .replace("</type>", "</type><accidental>natural</accidental>");
  const result = await convertScore({
    bytes: new TextEncoder().encode(xml),
    sourceName: "mismatch.musicxml",
    options: { mode: "PRESERVE" },
  });
  expect(result.candidate.notes[0].pitch).toBe(61);
  expect(result.candidate.notes[0].explicitAccidental).toBeUndefined();
  expect(
    result.issues.some(
      (index) =>
        index.code === "NOTATION_PITCH_MISMATCH" &&
        index.severity === "WARNING",
    ),
  ).toBe(true);
});
