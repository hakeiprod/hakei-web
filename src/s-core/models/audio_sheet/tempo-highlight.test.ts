import { afterEach, expect, test, vi } from "vitest";
import type { Controller } from "../browser/audio";
import { Beat, Tempo as TempoValue } from "../core/units";
import { Tempo } from "../core/tempo";
import { TempoMap } from "../core/tempo-map";
import type * as Sheet from "../sheet";
import { NoteHighlighter } from "./note-highlighter";

afterEach(() => vi.unstubAllGlobals());
test("highlights the same score time used by playback after a tempo change", () => {
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const setClassName = vi.fn();
  const map = new TempoMap([
    new Tempo({
      start: new Beat(0),
      duration: new Beat(4),
      value: new TempoValue(120),
    }),
    new Tempo({
      start: new Beat(4),
      duration: new Beat(4),
      value: new TempoValue(60),
    }),
  ]);
  const note = {
    start: new Beat(5),
    end: new Beat(6),
    glyph: { setClassName },
  };
  const highlighter = new NoteHighlighter(
    { notes: [note], tempoMap: map } as unknown as Sheet.Score,
    { timer: { elapsedSeconds: { value: 3.5 } } } as Controller,
  );
  highlighter.highlight();
  expect(setClassName).toHaveBeenCalledWith(["note-highlight"]);
});
