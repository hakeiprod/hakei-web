import { expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import { convertScore } from "./convert";

for (const [fixture, expected] of [
  ["drums/percussion-to-standard.musicxml", ["percussion", "standard"]],
  ["tab/tab-to-standard.musicxml", ["tablature", "standard"]],
] as const) {
  test(`staff type changes are effective in each measure: ${fixture}`, async () => {
    const result = await convertScore({
      bytes: await readFile(`src/s-core/fixtures/tab-drum/${fixture}`),
      options: { mode: "PRESERVE" },
    });
    expect("format" in result.candidate).toBe(false);
    if ("format" in result.candidate)
      throw new Error("Expected complete notation");
    expect(
      result.candidate.staves.map((stave) => stave.staffSettings?.kind),
    ).toEqual(expected);
    expect(result.candidate.staves[1].staffSettings?.lineCount).toBe(5);
    expect(result.candidate.notes[1].pitch).toBe(60);
    expect(result.candidate.notes[1].percussion).toBeUndefined();
    expect(result.candidate.notes[1].tablature).toBeUndefined();
    expect(
      result.issues.some((issue) =>
        ["MISSING_PITCH", "UNSUPPORTED_NOTATION", "UNSUPPORTED_STAFF"].includes(
          issue.code,
        ),
      ),
    ).toBe(false);
  });
}

test("changing a standard clef leaves the TAB clef on the other staff unchanged", async () => {
  const result = await convertScore({
    bytes: await readFile(
      "src/s-core/fixtures/tab-drum/mixed/independent-clef-change.musicxml",
    ),
    options: { mode: "PRESERVE" },
  });
  expect("format" in result.candidate).toBe(false);
  if ("format" in result.candidate)
    throw new Error("Expected complete notation");
  expect(result.candidate.staves).toMatchObject([
    { clefs: [{ sign: [{ _: "G" }] }] },
    { clefs: [{ sign: [{ _: "TAB" }] }] },
    { clefs: [{ sign: [{ _: "F" }] }] },
    { clefs: [{ sign: [{ _: "TAB" }], line: [{ _: 5 }] }] },
  ]);
});
