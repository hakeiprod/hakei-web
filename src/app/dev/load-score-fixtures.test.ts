// @vitest-environment node
import { readdir } from "node:fs/promises";
import { expect, test, vi } from "vitest";
import { loadScoreFixtures } from "./load-score-fixtures";

test("loads every MusicXML fixture as a serialized sheet or an individual error", async () => {
  const logging = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    const fixtures = await loadScoreFixtures("mxl");
    const entries = await readdir("src/s-core/fixtures/files/musicxml");
    const names = entries.filter((name) => name.endsWith(".mxl")).toSorted();
    expect(fixtures.map((fixture) => fixture.name)).toEqual(names);
    const eighths = fixtures.find(
      (fixture) => fixture.name === "beat_8th.mxl",
    )!;
    expect("sheet" in eighths).toBe(true);
    if ("sheet" in eighths) {
      expect(eighths.sheet.notes.length).toBeGreaterThan(0);
      // Verify the server-to-client JSON boundary, rather than cloning in memory.
      // eslint-disable-next-line unicorn/prefer-structured-clone
      expect(JSON.parse(JSON.stringify(eighths.sheet))).toEqual(eighths.sheet);
    }
    for (const fixture of fixtures) {
      expect("sheet" in fixture || "error" in fixture).toBe(true);
    }
  } finally {
    logging.mockRestore();
  }
});

test("loads Core JSON fixtures in filename order", async () => {
  const fixtures = await loadScoreFixtures("core");
  expect(fixtures.length).toBeGreaterThan(0);
  expect(fixtures.map((fixture) => fixture.name)).toEqual(
    fixtures.map((fixture) => fixture.name).toSorted(),
  );
  expect(fixtures.every((fixture) => "data" in fixture)).toBe(true);
});
