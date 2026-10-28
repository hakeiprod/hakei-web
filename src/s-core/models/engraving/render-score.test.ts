// @vitest-environment node
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import * as Engraving from ".";
import { LayoutType } from "../sheet";
import { convertScore } from "../import/convert";
import { drainCooperatively } from "../browser/render-scheduler";
import { drainSteps } from "../sheet/render-steps";
import "../document/extensions/to-svg";
import fixtures from "../../../../specs/010-fix-score-rendering/measurements/fixtures.json";
import references from "../../../../specs/010-fix-score-rendering/measurements/reference-with-separate-barline-manifest.json";

const directory = "specs/010-fix-score-rendering/measurements/";
const sha = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
// Keep each large SVG comparison in its own DOM, as in the independent
// benchmark, rather than retaining every fixture in the shared browser window.
const { JSDOM } = createRequire(import.meta.url)("jsdom");
let dom: { window: { document: Document; close(): void } };
beforeEach(() => {
  dom = new JSDOM();
  vi.stubGlobal("document", dom.window.document);
});
afterEach(() => {
  dom.window.close();
  vi.unstubAllGlobals();
});

const candidates = new Map<string, ReturnType<typeof convertScore>>();
const conditions = fixtures.fixtures.flatMap((fixture) =>
  fixtures.layouts.flatMap((layout) =>
    fixtures.viewports.flatMap((viewport) =>
      fixtures.scales.map((scale) => ({
        fixture,
        layout,
        viewport,
        scale,
        condition: `${fixture.id}-${layout}-${viewport.width}x${viewport.height}-${scale}`,
      })),
    ),
  ),
);

test.each(conditions)(
  "independent complete Document/SVG preservation: $condition",
  async ({ fixture, layout, viewport, scale, condition }) => {
    // Check the new path before entering any expensive legacy loop. Correctness
    // tests do not replace the externally timed, fresh-process performance trials.
    expect(Engraving.Score.importSteps).toBeTypeOf("function");
    expect(Engraving.Controller.prototype.mountSteps).toBeTypeOf("function");
    expect(Engraving.Controller.prototype.toDocumentSteps).toBeTypeOf(
      "function",
    );
    let pending = candidates.get(fixture.id);
    if (!pending) {
      pending = readFile(fixture.path).then((bytes) => {
        expect(sha(bytes)).toBe(fixture.sha256);
        return convertScore({
          bytes,
          sourceName: fixture.path,
          options: { mode: "PRESERVE" },
        });
      });
      candidates.set(fixture.id, pending);
    }
    const converted = await pending;
    if ("format" in converted.candidate)
      throw new Error("Expected complete Sheet fixture");
    const candidate = converted.candidate as unknown as ReturnType<
        Engraving.Score["export"]
      >,
      before = JSON.stringify(converted);
    if (fixture.id === "naitoobunaitsu-bitomario") {
      expect(candidate.notes.length).toBe(5540);
      expect(
        sha(
          JSON.stringify(
            candidate.notes.map((note) => [
              note.trackId,
              note.rest ? null : note.pitch,
              note.start,
              note.duration,
              note.voice,
              note.staveId,
              note.rest,
            ]),
          ),
        ),
      ).toBe(fixtures.independentMeaning.sha256);
    }
    const options = {
      layoutType: LayoutType[layout as keyof typeof LayoutType],
      scale,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      advanced: true,
      debug: false,
    };
    const reference = references.references.find(
      (entry) => entry.condition === condition,
    )!;
    for (const cooperative of [true, false]) {
      const drain = cooperative ? drainCooperatively : drainSteps;
      const score = cooperative
        ? await drain(Engraving.Score.importSteps(candidate))
        : Engraving.Score.import(candidate);
      const controller = new Engraving.Controller(score, options);
      if (cooperative) await drain(controller.mountSteps());
      else controller.mount();
      const drawing = cooperative
        ? await drain(controller.toDocumentSteps())
        : controller.toDocument();
      const documentArtifact = reference.artifacts.find((artifact) =>
        artifact.path.endsWith("document.json.gz"),
      )!;
      const expectedDocument = await readFile(
        directory + documentArtifact.path,
      );
      expect(sha(expectedDocument)).toBe(documentArtifact.sha256);
      expect(sha(JSON.stringify(drawing))).toBe(
        sha(gunzipSync(expectedDocument)),
      );
      const svgPages: string[] = [];
      for (let pageIndex = 0; pageIndex < drawing.pages.length; pageIndex++) {
        const options = {
          pageIndex,
          scale,
          fontFamily: "Bravura",
          paddingBottom: layout === "Page" ? 0 : 100,
        };
        const svg = cooperative
          ? await drainCooperatively(drawing.toSVGSteps(options))
          : drawing.toSVG(options);
        svgPages.push(svg.outerHTML);
      }
      const svg = svgPages.join("\n");
      const svgArtifact = reference.artifacts.find((artifact) =>
        artifact.path.endsWith("svg.gz"),
      )!;
      const expectedSVG = await readFile(directory + svgArtifact.path);
      expect(sha(expectedSVG)).toBe(svgArtifact.sha256);
      expect(sha(svg)).toBe(sha(gunzipSync(expectedSVG)));
      expect(JSON.stringify(converted)).toBe(before);
    }
  },
  120_000,
);

test("the independent reference index retains all 96 conditions and the authorized geometry overlay", async () => {
  expect(references.references).toHaveLength(conditions.length);
  expect(
    new Set(references.references.map((entry) => entry.condition)).size,
  ).toBe(96);
  expect(sha(await readFile(directory + references.overlay))).toBe(
    references.overlaySha256,
  );
  expect(sha(await readFile("src/s-core/models/engraving/geometry.ts"))).toBe(
    references.geometrySha256,
  );
});
