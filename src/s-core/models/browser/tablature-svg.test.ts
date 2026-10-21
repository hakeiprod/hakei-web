import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";
import { convertScore } from "../import/convert";
import { prepareFixture } from "../fixtures/prepare";
import { fixtureManifestSchema } from "../fixtures/manifest";
import { svgRecords } from "./evaluate-fixture-svg";
import { evaluateAssertion } from "../fixtures/evaluate";
import "../document/extensions/to-svg";
test("missing, reordered and moved actual digits fail even with valid fret metadata", async () => {
  const m = fixtureManifestSchema.parse(
    JSON.parse(
      await readFile("src/s-core/fixtures/tab-drum/manifest.json", "utf8"),
    ),
  );
  const f = m.fixtures.find((f) => f.id === "tab/fret-10")!;
  const result = await convertScore({
    bytes: await readFile(`src/s-core/fixtures/${f.source.path}`),
    options: { mode: "PRESERVE" },
  });
  const { controller, document } = prepareFixture(result.candidate, f);
  try {
    const pages = document.pages.map((_, pageIndex) =>
      document.toSVG({ pageIndex }),
    );
    const assertion = f.assertions.find(
      (a) => a.stage === "svg" && a.selector.tabValue === "10",
    )!;
    expect(evaluateAssertion(f.id, assertion, svgRecords(pages)).status).toBe(
      "pass",
    );
    const texts = [
      ...pages[0].querySelectorAll<SVGTextElement>('[type="tab-digit"] text'),
    ];
    const content = texts.map((t) => t.textContent);
    texts[0].textContent = content[1];
    texts[1].textContent = content[0];
    expect(evaluateAssertion(f.id, assertion, svgRecords(pages)).status).toBe(
      "fail",
    );
    texts[0].textContent = content[0];
    texts[1].textContent = content[1];
    const position = f.assertions.find((a) => a.id === "svg-position")!;
    texts[0].setAttribute("y", String(Number(texts[0].getAttribute("y")) + 1));
    expect(evaluateAssertion(f.id, position, svgRecords(pages)).status).toBe(
      "fail",
    );
    texts[0].textContent = "";
    expect(evaluateAssertion(f.id, assertion, svgRecords(pages)).status).toBe(
      "fail",
    );
  } finally {
    controller.unmount();
  }
});
