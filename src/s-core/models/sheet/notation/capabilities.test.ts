/* Normalize parser/model data through the actual JSON transport boundary. */
/* eslint-disable unicorn/prefer-structured-clone */
import { expect, test } from "vitest";
import { capabilities } from "./capabilities";
import { Score } from "../../core";
import "../../core/extensions/to-sheet";
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
