import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";
import { convertScore } from "../import/convert";
import { fixtureManifestSchema } from "../fixtures/manifest";
import { prepareFixture } from "../fixtures/prepare";
import { evaluateAssertion } from "../fixtures/evaluate";
import { svgRecords } from "./evaluate-fixture-svg";
import "../document/extensions/to-svg";
test("detects altered endpoints and missing continuation segments in SVG", async () => {
  const manifest = fixtureManifestSchema.parse(
    JSON.parse(
      await readFile("src/s-core/fixtures/notation/manifest.json", "utf8"),
    ),
  );
  const fixture = manifest.fixtures.find((f) => f.id === "tie/same-bar")!;
  const candidate = await convertScore({
    bytes: await readFile(`src/s-core/fixtures/${fixture.source.path}`),
    sourceName: fixture.source.path,
    options: { mode: "PRESERVE" },
  });
  const { controller, document } = prepareFixture(candidate.candidate, fixture);
  try {
    const pages = document.pages.map((_, pageIndex) =>
      document.toSVG({ pageIndex }),
    );
    const assertion = fixture.assertions.find(
      (a) => a.kind === "tieEndpoints" && a.stage === "svg",
    )!;
    expect(
      evaluateAssertion(fixture.id, assertion, svgRecords(pages)).status,
    ).toBe("pass");
    pages[0].querySelector<SVGElement>('[type="tie"]')!.dataset.endNoteId =
      "99";
    expect(
      evaluateAssertion(fixture.id, assertion, svgRecords(pages)).status,
    ).toBe("fail");
    pages[0].querySelector('[type="tie"]')!.remove();
    expect(
      evaluateAssertion(fixture.id, assertion, svgRecords(pages)).status,
    ).toBe("fail");
  } finally {
    controller.unmount();
  }
});
