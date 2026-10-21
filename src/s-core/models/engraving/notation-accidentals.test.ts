import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";
import { convertScore } from "../import/convert";
import { fixtureManifestSchema } from "../fixtures/manifest";
import { prepareFixture } from "../fixtures/prepare";
import { documentRecords } from "../fixtures/evaluate";
const manifest = fixtureManifestSchema.parse(
  JSON.parse(
    await readFile("src/s-core/fixtures/notation/manifest.json", "utf8"),
  ),
);
for (const id of [
  "accidental/enharmonic-spelling",
  "accidental/parentheses",
  "accidental/chord-neighbors",
])
  test(id, async () => {
    const fixture = manifest.fixtures.find((f) => f.id === id)!;
    const result = await convertScore({
      bytes: await readFile(`src/s-core/fixtures/${fixture.source.path}`),
      sourceName: fixture.source.path,
      options: { mode: "PRESERVE" },
    });
    const before = JSON.stringify(result.candidate);
    const { controller, document } = prepareFixture(result.candidate, fixture);
    try {
      const records = documentRecords(document);
      const heads = records.filter((r) => r.glyphName === "noteheadBlack");
      if (id.includes("enharmonic"))
        expect(heads[0].y! - heads[1].y!).toBeCloseTo(0.5);
      const accidentals = records.filter(
        (r) =>
          r.glyphName?.startsWith("accidental") &&
          r.source?.noteId !== undefined,
      );
      expect(new Set(accidentals.map((r) => r.x)).size).toBe(
        accidentals.length,
      );
      expect(controller.toDocument().pages[0].width).toBe(
        document.pages[0].width,
      );
      expect(JSON.stringify(result.candidate)).toBe(before);
    } finally {
      controller.unmount();
    }
  });

test("reserves all accidental columns and keeps noteheads and ledger lines on the same origin", async () => {
  const fixture = manifest.fixtures.find(
    (f) => f.id === "accidental/parentheses",
  )!;
  const candidate = await convertScore({
    bytes: await readFile(`src/s-core/fixtures/${fixture.source.path}`),
    sourceName: fixture.source.path,
    options: { mode: "PRESERVE" },
  });
  const { controller, score, document } = prepareFixture(
    candidate.candidate,
    fixture,
  );
  try {
    const records = documentRecords(document);
    const head = records.find((r) => r.glyphName === "noteheadBlack")!;
    const signs = records.filter(
      (r) => r.glyphName?.startsWith("accidental") && r.source?.noteId === 0,
    );
    expect(head.x!).toBeGreaterThan(
      Math.max(...signs.map((r) => r.bounds!.x + r.bounds!.width)),
    );
    for (const chord of score.chords)
      expect(chord.width).toBeGreaterThanOrEqual(chord.word.width);
    const ledger = records.find((r) => r.glyphName === "legerLine")!;
    expect(Math.abs(ledger.x! - head.x!)).toBeLessThan(0.001);
  } finally {
    controller.unmount();
  }
});
