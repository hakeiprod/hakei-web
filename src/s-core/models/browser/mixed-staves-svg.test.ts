import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";
import { fixtureManifestSchema } from "../fixtures/manifest";
import { prepareFixture } from "../fixtures/prepare";
import { convertScore } from "../import/convert";
import { svgRecords } from "./evaluate-fixture-svg";
import "../document/extensions/to-svg";
test("all mixed pages keep semantic staff identities and independent anchors", async () => {
  const m = fixtureManifestSchema.parse(
    JSON.parse(
      await readFile("src/s-core/fixtures/tab-drum/manifest.json", "utf8"),
    ),
  );
  const f = m.fixtures.find((f) => f.id === "mixed/pages")!;
  const { candidate } = await convertScore({
    bytes: await readFile(`src/s-core/fixtures/${f.source.path}`),
    options: { mode: "PRESERVE" },
  });
  const { controller, document } = prepareFixture(candidate, f);
  try {
    expect(document.pages.length).toBeGreaterThan(1);
    const pages = document.pages.map((_, pageIndex) =>
      document.toSVG({ pageIndex }),
    );
    const records = svgRecords(pages);
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      expect(
        records.filter((r) => r.pageIndex === pageIndex && r.role === "staff-line")
          .length,
      ).toBeGreaterThan(0);
      expect(
        records.filter(
          (r) => r.pageIndex === pageIndex && r.anchorRole === "note-anchor",
        ).length,
      ).toBeGreaterThan(0);
    }
  } finally {
    controller.unmount();
  }
});
