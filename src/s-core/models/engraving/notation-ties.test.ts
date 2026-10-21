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
  "tie/same-bar",
  "tie/cross-bar",
  "tie/system-break",
  "tie/page-break",
  "tie/chord-member",
])
  test(`anchors and page bounds: ${id}`, async () => {
    const fixture = manifest.fixtures.find((f) => f.id === id)!;
    const conversion = await convertScore({
      bytes: await readFile(`src/s-core/fixtures/${fixture.source.path}`),
      sourceName: fixture.source.path,
      options: { mode: "PRESERVE" },
    });
    const { controller, document } = prepareFixture(
      conversion.candidate,
      fixture,
    );
    try {
      const records = documentRecords(document);
      const curves = records.filter((r) => r.role === "tie");
      expect(curves.length).toBeGreaterThan(0);
      for (const curve of curves) {
        expect(curve.start!.x).toBeLessThan(curve.end!.x);
        const b = curve.bounds!,
          page = curve.pageBounds!;
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.y + b.height).toBeLessThanOrEqual(page.height);
        const start = records.find(
          (r) =>
            r.pageIndex === curve.pageIndex &&
            r.glyphName?.startsWith("notehead") &&
            r.source?.trackId === curve.startNote?.trackId &&
            r.source?.noteId === curve.startNote?.noteId,
        );
        if (curve.part !== "incoming")
          expect(
            Math.abs(curve.start!.x - (start!.x! + start!.bounds!.width)),
          ).toBeLessThan(0.2);
      }
      const again = controller.toDocument();
      expect(
        documentRecords(again)
          .filter((r) => r.role === "tie")
          .map((r) => r.bounds),
      ).toEqual(curves.map((r) => r.bounds));
      if (id === "tie/page-break")
        expect(document.pages.length).toBeGreaterThan(1);
    } finally {
      controller.unmount();
    }
  });
