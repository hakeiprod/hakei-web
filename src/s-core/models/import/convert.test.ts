// @vitest-environment node
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { convertScore } from "./convert";
it("returns server-computed validation and metadata without raw bytes", async () => {
  const bytes = await readFile("src/s-core/fixtures/import/quarter.musicxml");
  const original = new Uint8Array(bytes);
  const result = await convertScore({
    bytes,
    sourceName: "quarter.musicxml",
    options: { mode: "PRESERVE" },
  });
  expect(result.canPractice).toBe(true);
  expect(result.metadata).toMatchObject({
    format: "MUSICXML",
    formatVersion: "4.0",
  });
  expect(bytes).toEqual(Buffer.from(original));
  expect(JSON.stringify(result)).not.toContain("onsetTicks");
  expect(result).not.toHaveProperty("bytes");
});
it("rejects oversize and invalid options before a conversion", async () => {
  await expect(
    convertScore({
      bytes: new Uint8Array(5 * 1024 * 1024 + 1),
      sourceName: "score.mid",
      options: { mode: "PRESERVE" },
    }),
  ).rejects.toThrow("INPUT_LIMIT");
  await expect(
    convertScore({
      bytes: new TextEncoder().encode("{}"),
      sourceName: "score.json",
      options: { mode: "QUANTIZE", grid: "1/2" },
    }),
  ).rejects.toThrow("INVALID_CONVERSION_OPTIONS");
});

it("certifies every format and diagnostic fixture in the manifest", async () => {
  const directory = "src/s-core/fixtures/import/";
  const manifest = JSON.parse(
    await readFile(directory + "manifest.json", "utf8"),
  ) as {
    fixtures: {
      path: string;
      outcome: string;
      notes?: number[][];
      code?: string;
      error?: string;
      options?: { mode: "QUANTIZE"; grid: "1/2" };
    }[];
  };
  for (const fixture of manifest.fixtures) {
    const input = {
      bytes: await readFile(directory + fixture.path),
      sourceName: fixture.path,
      options: fixture.options ?? { mode: "PRESERVE" as const },
    };
    if (fixture.outcome === "FATAL") {
      await expect(convertScore(input), fixture.path).rejects.toThrow(
        fixture.error,
      );
      continue;
    }
    const result = await convertScore(input);
    expect(result.canPractice, fixture.path).toBe(
      fixture.outcome === "PLAYABLE",
    );
    if (fixture.code)
      expect(
        result.issues.some((issue) => issue.code === fixture.code),
        fixture.path,
      ).toBe(true);
    if (fixture.outcome === "PARTIAL")
      expect(result.candidate).toHaveProperty("format", "converted-partial-v1");
    if (fixture.notes)
      expect(
        result.candidate.notes
          .filter((note) => !note.rest)
          .map((note) => [
            note.pitch,
            "start" in note ? note.start : note.onset,
            note.duration,
          ]),
        fixture.path,
      ).toEqual(fixture.notes);
  }
});
it("converts bytes without browser file metadata and checks an explicit format hint", async () => {
  const bytes = await readFile("src/s-core/fixtures/import/quarter.mid");
  const result = await convertScore({
    bytes,
    formatHint: "MIDI",
    options: { mode: "PRESERVE" },
  });
  expect(result.metadata.format).toBe("MIDI");
  expect(result.metadata).not.toHaveProperty("sourceName");
  await expect(
    convertScore({
      bytes,
      formatHint: "MUSICXML",
      options: { mode: "PRESERVE" },
    }),
  ).rejects.toThrow("FORMAT_MISMATCH");
});
