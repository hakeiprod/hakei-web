import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";
import { fixtureManifestSchema } from "../fixtures/manifest";
import { prepareFixture } from "../fixtures/prepare";
import { convertScore } from "../import/convert";
import { documentRecords } from "../fixtures/evaluate";
for (const id of ["drum/kick", "drum/crash", "drum/rest-null-quarter"])
  test(`unpitched geometry preserves source: ${id}`, async () => {
    const m = fixtureManifestSchema.parse(
      JSON.parse(
        await readFile("src/s-core/fixtures/tab-drum/manifest.json", "utf8"),
      ),
    );
    const f = m.fixtures.find((f) => f.id === id)!;
    const { candidate } = await convertScore({
      bytes: await readFile(`src/s-core/fixtures/${f.source.path}`),
      options: { mode: "PRESERVE" },
    });
    const original = structuredClone(candidate);
    const { controller, score, document } = prepareFixture(candidate, f);
    try {
      expect(candidate).toEqual(original);
      expect(score.notes[0].pitch).toBeNull();
      const records = documentRecords(document);
      expect(
        records.filter((r) => r.glyphName?.startsWith("accidental")),
      ).toHaveLength(0);
      const again = controller.toDocument();
      expect(documentRecords(again)).toEqual(records);
      if (id.includes("rest"))
        expect(records.some((r) => r.anchorRole === "note-anchor")).toBe(false);
    } finally {
      controller.unmount();
    }
  });
