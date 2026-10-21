import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";
import { z } from "zod";
import { convertScore } from "@/s-core/models/import/convert";
import { promotePartial } from "@/s-core/models/import/promote-partial";
import { payloadHash } from "./contracts";

for (const filename of ["conflicting-string-input", "tuning-conflict"]) {
  test(`a saved partial ${filename} can remain partial when proposed again`, async () => {
    const converted = await convertScore({
      bytes: await readFile(
        `src/s-core/fixtures/tab-drum/tab/${filename}.musicxml`,
      ),
      options: { mode: "PRESERVE" },
    });
    expect("format" in converted.candidate).toBe(true);
    const before = structuredClone(converted.candidate);
    const promoted = promotePartial(converted.candidate);
    expect(promoted.candidate).toEqual(before);
    expect(converted.candidate).toEqual(before);
    expect("format" in promoted.candidate).toBe(true);
    expect(() => payloadHash(promoted.candidate)).not.toThrow();
  });
}

test("unmapped percussion produces valid JSON for preview signatures", async () => {
  const converted = await convertScore({
    bytes: await readFile(
      "src/s-core/fixtures/tab-drum/drums/percussion-to-standard.musicxml",
    ),
    options: { mode: "PRESERVE" },
  });
  expect("format" in converted.candidate).toBe(false);
  expect(() => z.json().parse(converted.candidate)).not.toThrow();
  expect(() =>
    payloadHash({
      candidate: converted.candidate,
      issues: converted.issues,
      metadata: converted.metadata,
    }),
  ).not.toThrow();
  expect(converted.candidate.notes[0].percussion).toMatchObject({
    displayStep: "C",
    displayOctave: 5,
    notehead: "normal",
  });
  expect(
    Object.hasOwn(converted.candidate.notes[0].percussion!, "instrumentId"),
  ).toBe(false);
});
