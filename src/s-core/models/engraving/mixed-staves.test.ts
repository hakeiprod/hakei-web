import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";
import { fixtureManifestSchema } from "../fixtures/manifest";
import { convertScore } from "../import/convert";
import { prepareFixture } from "../fixtures/prepare";
import { documentRecords } from "../fixtures/evaluate";
for (const id of [
  "mixed/four-line-first",
  "mixed/track-four-first",
  "mixed/normal-tab",
  "mixed/pages",
])
  test(`aligns independent staff geometry: ${id}`, async () => {
    const m = fixtureManifestSchema.parse(
      JSON.parse(
        await readFile("src/s-core/fixtures/tab-drum/manifest.json", "utf8"),
      ),
    );
    const f = m.fixtures.find((f) => f.id === id)!;
    const result = await convertScore({
      bytes: await readFile(`src/s-core/fixtures/${f.source.path}`),
      options: { mode: "PRESERVE" },
    });
    const { controller, document } = prepareFixture(result.candidate, f);
    try {
      const records = documentRecords(document);
      const first = records.filter(
        (r) => r.anchorRole === "note-anchor" && r.source?.barId === 0,
      );
      expect(first.length).toBeGreaterThanOrEqual(2);
      const glyphs = records.filter(
        (r) =>
          (r.role === "tab-digit" || r.glyphName === "noteheadBlack") &&
          r.source?.barId === 0,
      );
      expect(
        Math.max(...glyphs.map((r) => r.x!)) -
          Math.min(...glyphs.map((r) => r.x!)),
      ).toBeLessThan(2);
      if (id === "mixed/pages")
        expect(document.pages.length).toBeGreaterThan(1);
      const again = controller.toDocument();
      expect(documentRecords(again)).toEqual(records);
    } finally {
      controller.unmount();
    }
  });
