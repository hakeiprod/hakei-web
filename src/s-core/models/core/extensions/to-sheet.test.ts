/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import * as Core from "..";
import "./to-sheet";

const fixtures = import.meta.glob("../../../fixtures/core/*.json", {
  eager: true,
  import: "default",
}) as Record<string, Parameters<typeof Core.Score.create>[0]>;

describe("Core.Score.toSheet", () => {
  test.each(Object.entries(fixtures))(
    "loads and lays out fixture %s without throwing",
    (_path, fixture) => {
      const score = Core.Score.create(fixture).toSheet();

      for (const note of score.notes) {
        note.draw();
        expect(Number.isFinite(note.line)).toBe(true);
      }
      for (const chord of score.chords) chord.draw();
    },
  );
});
