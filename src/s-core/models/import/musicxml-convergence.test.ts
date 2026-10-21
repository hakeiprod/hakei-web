/* JSON transport intentionally removes undefined fields. */
/* eslint-disable unicorn/prefer-structured-clone */
import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";
import { convertScore } from "./convert";
import { partialScoreSchema } from "./contracts";
import { promotePartial } from "./promote-partial";

async function convert(source: string) {
  return convertScore({
    bytes: new TextEncoder().encode(source),
    options: { mode: "PRESERVE" },
  });
}

test("ghost note parentheses retain source and diagnose omitted appearance", async () => {
  const original = await readFile(
    "src/s-core/fixtures/tab-drum/drums/snare.musicxml",
    "utf8",
  );
  const source = original.replace(
    "<notehead>normal</notehead>",
    '<notehead parentheses="yes">normal</notehead>',
  );
  const result = await convert(source);
  expect("format" in result.candidate).toBe(false);
  expect(
    result.issues.some(
      (issue) =>
        issue.code === "UNSUPPORTED_TECHNIQUE" &&
        issue.track === 0 &&
        issue.bar === 0,
    ),
  ).toBe(true);
  expect(JSON.stringify(result.candidate.notes[0].sourceNotation)).toContain(
    '"parentheses":"yes"',
  );
  expect(result.validation.canPractice).toBe(false);
});

test("unsupported string count retains original staff details through JSON", async () => {
  const result = await convert(
    await readFile(
      "src/s-core/fixtures/tab-drum/tab/unsupported-strings.musicxml",
      "utf8",
    ),
  );
  expect("format" in result.candidate).toBe(true);
  if (!("format" in result.candidate)) throw new Error("Expected partial");
  const transported = JSON.parse(JSON.stringify(result.candidate));
  expect(promotePartial(transported).candidate).toEqual(result.candidate);
  const notation = transported.notation;
  expect(notation.sourceStaves[0]).toMatchObject({
    trackId: 0,
    barId: 0,
    staveId: 0,
  });
  expect(
    notation.sourceStaves[0].attributes["staff-details"][0]["staff-lines"][0]._,
  ).toBe(7);
  notation.sourceStaves[0].oversized = "x".repeat(65_537);
  expect(partialScoreSchema.safeParse(transported).success).toBe(false);
});

for (const [externalNote, externalChannel, internalNote, internalChannel] of [
  [1, 1, 0, 0],
  [128, 16, 127, 15],
]) {
  test(`MIDI external endpoints ${externalNote}/${externalChannel}`, async () => {
    const original = await readFile(
      "src/s-core/fixtures/tab-drum/drums/snare.musicxml",
      "utf8",
    );
    const source = original
      .replaceAll(
        /<midi-unpitched>\d+<\/midi-unpitched>/g,
        `<midi-unpitched>${externalNote}</midi-unpitched>`,
      )
      .replaceAll(
        /<midi-channel>\d+<\/midi-channel>/g,
        `<midi-channel>${externalChannel}</midi-channel>`,
      );
    const result = await convert(source);
    expect(result.candidate.notes[0].percussion).toMatchObject({
      midiNote: internalNote,
      midiChannel: internalChannel,
    });
  });
}
for (const [tag, value] of [
  ["midi-unpitched", 0],
  ["midi-unpitched", 129],
  ["midi-channel", 0],
  ["midi-channel", 17],
] as const) {
  test(`invalid external ${tag}=${value} stays partial with source`, async () => {
    const original = await readFile(
      "src/s-core/fixtures/tab-drum/drums/snare.musicxml",
      "utf8",
    );
    const source = original.replaceAll(
      new RegExp(String.raw`<${tag}>\d+</${tag}>`, "g"),
      `<${tag}>${value}</${tag}>`,
    );
    const result = await convert(source);
    expect("format" in result.candidate).toBe(true);
    expect(
      result.issues.some((issue) => issue.code === "UNSUPPORTED_NOTATION"),
    ).toBe(true);
    const retained = JSON.parse(
      JSON.stringify(result.candidate.notes[0].sourceNotation),
    );
    expect(retained.sourceInstrument[tag][0]._).toBe(value);
  });
}

for (const [name, extra, retainedKey] of [
  [
    "roll",
    '<notations><ornaments><tremolo type="single">3</tremolo></ornaments></notations>',
    "ornaments",
  ],
  [
    "open hi-hat",
    "<notations><articulations><other-articulation>open hi-hat</other-articulation></articulations></notations>",
    "articulations",
  ],
  [
    "brush",
    "<notations><technical><other-technical>brush sweep</other-technical></technical></notations>",
    "technical",
  ],
]) {
  test(`unsupported drum ${name} survives JSON and Sheet transport`, async () => {
    const original = await readFile(
      "src/s-core/fixtures/tab-drum/drums/snare.musicxml",
      "utf8",
    );
    const result = await convert(
      original.replace("</note>", `${extra}</note>`),
    );
    expect("format" in result.candidate).toBe(false);
    expect(
      result.issues.some(
        (issue) =>
          issue.code === "UNSUPPORTED_TECHNIQUE" &&
          issue.track === 0 &&
          issue.bar === 0,
      ),
    ).toBe(true);
    const note = result.candidate.notes[0];
    expect(JSON.stringify(note.sourceNotation)).toContain(`"${retainedKey}"`);
    expect(result.validation.canPractice).toBe(false);
    if ("format" in result.candidate)
      throw new Error("Expected complete basic notation");
    const transported = JSON.parse(JSON.stringify(result.candidate));
    const { Score } = await import("../sheet");
    expect(Score.import(transported).export().notes[0].sourceNotation).toEqual(
      note.sourceNotation,
    );
    expect(transported.notes[0].percussion).toEqual(note.percussion);
  });
}

test("drum grace without a duration stays partial and retains the original grace", async () => {
  const original = await readFile(
    "src/s-core/fixtures/tab-drum/drums/snare.musicxml",
    "utf8",
  );
  const source = original.replace(
    "<duration>4</duration>",
    '<grace slash="yes"/>',
  );
  const result = await convert(source);
  expect("format" in result.candidate).toBe(true);
  expect(result.candidate.notes[0].duration).toBeNull();
  expect(
    result.issues.some((issue) => issue.code === "UNSUPPORTED_TECHNIQUE"),
  ).toBe(true);
  const transported = JSON.parse(JSON.stringify(result.candidate));
  expect(transported.notes[0].sourceNotation.grace[0].$.slash).toBe("yes");
  expect(promotePartial(transported).candidate).toEqual(result.candidate);
});
