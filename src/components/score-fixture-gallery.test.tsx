import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ScoreFixtureGallery } from "./score-fixture-gallery";
import * as Core from "@/s-core/models/core";
import "@/s-core/models/core/extensions/to-sheet";
import { fixtureSchema } from "@/s-core/models/fixtures/manifest";
vi.mock("next/font/local", () => ({
  default: () => ({ className: "bravura", style: { fontFamily: "Bravura" } }),
}));
afterEach(cleanup);
const definition = fixtureSchema.parse({
  id: "head",
  title: "head",
  target: "One black head",
  requirementRefs: ["FR-003"],
  source: {
    path: "core/quarter_middle_c.json",
    format: "CORE_JSON",
    provenance: "existing",
  },
  expectedOutcome: "render",
  requiredStages: ["document", "svg", "visual"],
  layout: { type: "Horizontal", scale: 12, viewportWidth: 800 },
  assertions: [
    {
      id: "head-doc",
      stage: "document",
      kind: "count",
      selector: { glyphName: "noteheadBlack" },
      expected: 1,
    },
    {
      id: "head-svg",
      stage: "svg",
      kind: "count",
      selector: { glyphName: "noteheadBlack" },
      expected: 1,
    },
  ],
  visualChecklist: [{ id: "visual-head", expected: "Black head is visible" }],
});
test("shows expectations but does not turn successful SVG generation into a visual pass", () => {
  const { getByText, container } = render(
    <ScoreFixtureGallery
      fixtures={[
        {
          name: "head",
          definition,
          data: { tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }] },
        },
      ]}
    />,
  );
  expect(getByText("Rendered")).toBeDefined();
  expect(getByText("One black head")).toBeDefined();
  expect(getByText("検証: pending")).toBeDefined();
  expect(container.textContent).toContain("head-doc: 1 · pass");
  expect(container.textContent).toContain("Black head is visible · pending");
});
test("shows expected rejection without trying to render and exposes corrupt reports", () => {
  const reject = fixtureSchema.parse({
    ...definition,
    expectedOutcome: "reject",
    rejectionStage: "persisted",
    requiredStages: ["persisted"],
    assertions: [
      {
        id: "reject",
        stage: "persisted",
        kind: "value",
        selector: { path: "error" },
        expected: "INVALID",
      },
    ],
    visualChecklist: [],
  });
  const { container, getByText } = render(
    <ScoreFixtureGallery
      fixtures={[
        {
          name: "reject",
          definition: reject,
          rejected: true,
          reportError: "Corrupt report",
        },
      ]}
    />,
  );
  expect(container.querySelector("svg")).toBeNull();
  expect(getByText("Corrupt report")).toBeDefined();
  expect(getByText("検証: error")).toBeDefined();
});
test("renders every page of fixed page-layout fixtures", () => {
  const sheet = Core.Score.create({
    tracks: [
      {
        notes: Array.from({ length: 8 }, (_, index) => ({
          pitch: 60,
          start: index * 4,
          duration: 1,
        })),
      },
    ],
  })
    .toSheet()
    .export();
  const page = {
    ...definition,
    layout: {
      type: "Page" as const,
      scale: 12,
      pageLayout: { width: 12, height: 12, margin: 1 },
    },
  };
  const { container } = render(
    <ScoreFixtureGallery
      fixtures={[{ name: "pages", definition: page, sheet }]}
    />,
  );
  expect(container.querySelectorAll("svg").length).toBeGreaterThan(1);
});
