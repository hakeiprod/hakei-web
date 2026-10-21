// @vitest-environment node
import { readFile, readdir } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Importer } from "../../../browser/importer";
import { Score } from "../../../sheet";

const directory = "src/s-core/fixtures/files/musicxml";
const entries = await readdir(directory);
// Menuett has explicit repeat blockers; its preview/save contract is tested in import/menuett.test.ts.
const fixtures = entries
  .filter(
    (name) =>
      name.endsWith(".mxl") && name !== "Menuett_in_G-Dur_BWV_Anh._114.mxl",
  )
  .toSorted();

beforeEach(() => vi.spyOn(console, "log").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe("MusicXML to Sheet", () => {
  test("has MXL fixtures to exercise", () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });
  test.each(fixtures)("imports %s without throwing", async (name) => {
    const contents = await readFile(`${directory}/${name}`);
    const sheet = await new Importer().import(
      new File([new Uint8Array(contents)], name),
    );
    expect(sheet).toBeInstanceOf(Score);
    expect(sheet.tracks.length).toBeGreaterThan(0);
    expect(sheet.notes.length).toBeGreaterThan(0);
    for (const note of sheet.notes) {
      expect(Number.isFinite(note.pitch!.value)).toBe(true);
      expect(Number.isFinite(note.start.value)).toBe(true);
      expect(Number.isFinite(note.duration.value)).toBe(true);
      expect(note.duration.value).toBeGreaterThan(0);
    }
    expect(() => sheet.export()).not.toThrow();
  });
});
