/* Normalize parser/model data through the actual JSON transport boundary. */
/* eslint-disable unicorn/prefer-structured-clone */
import { expect, test, vi } from "vitest";
import sheet from "../../../fixtures/import/quarter-sheet.json";
import { capabilities } from "./capabilities";
import { Score } from "../../core";
import "../../core/extensions/to-sheet";
test("checks capabilities without runtime code generation when requested", () => {
  const originalFunction = globalThis.Function;
  let actual: ReturnType<typeof capabilities>;
  vi.stubGlobal("Function", () => {
    throw new Error("Runtime code generation disabled");
  });
  try {
    actual = capabilities(sheet, [], { jitless: true });
  } finally {
    vi.stubGlobal("Function", originalFunction);
  }
  expect(actual).toEqual(capabilities(sheet));
  expect(actual.canRender).toBe(true);
  const invalid = { ...sheet, tracks: [] };
  expect(capabilities(invalid, [], { jitless: true })).toEqual(
    capabilities(invalid),
  );
  expect(capabilities(invalid, [], { jitless: true }).canPlayback).toBe(false);
});
test("separates display and performance without inventing pitches", () => {
  const s = Score.create({
    tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }],
  })
    .toSheet()
    .export();
  expect(capabilities(s).canPlayback).toBe(true);
  const d = JSON.parse(JSON.stringify(s));
  d.staves[0].staffSettings = { kind: "percussion", lineCount: 5 };
  d.notes[0].pitch = null;
  d.notes[0].percussion = {
    displayStep: "C",
    displayOctave: 5,
    notehead: "normal",
  };
  expect(capabilities(d)).toMatchObject({
    canRender: true,
    canPlayback: false,
    canPractice: false,
    canGame: false,
  });
  expect(capabilities({ format: "converted-partial-v1" }).canRender).toBe(
    false,
  );
});
