import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";
import { fixtureManifestSchema } from "../fixtures/manifest";
import { prepareFixture } from "../fixtures/prepare";
import { convertScore } from "../import/convert";
import { evaluateAssertion } from "../fixtures/evaluate";
import { svgRecords } from "./evaluate-fixture-svg";
import "../document/extensions/to-svg";
test("a percussion symbol with correct metadata but wrong visible character fails", async () => {
  const m = fixtureManifestSchema.parse(
    JSON.parse(
      await readFile("src/s-core/fixtures/tab-drum/manifest.json", "utf8"),
    ),
  );
  const f = m.fixtures.find((f) => f.id === "drum/closed-hihat")!;
  const { candidate } = await convertScore({
    bytes: await readFile(`src/s-core/fixtures/${f.source.path}`),
    options: { mode: "PRESERVE" },
  });
  const { controller, document } = prepareFixture(candidate, f);
  try {
    const pages = document.pages.map((_, pageIndex) =>
      document.toSVG({ pageIndex }),
    );
    const a = f.assertions.find(
      (a) => a.stage === "svg" && a.selector.glyphName === "noteheadXBlack",
    )!;
    expect(evaluateAssertion(f.id, a, svgRecords(pages)).status).toBe("pass");
    pages[0].querySelector(
      '[data-glyph-name="noteheadXBlack"] text',
    )!.textContent = String.fromCodePoint(0xe0_a4);
    expect(evaluateAssertion(f.id, a, svgRecords(pages)).status).toBe("fail");
  } finally {
    controller.unmount();
  }
});
