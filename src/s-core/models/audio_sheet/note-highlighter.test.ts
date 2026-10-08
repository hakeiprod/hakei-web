import { afterEach, expect, test, vi } from "vitest";
import type { Controller } from "../browser/audio";
import { Beat, Tempo } from "../core/units";
import * as Sheet from "../sheet";
import { NoteHighlighter } from "./note-highlighter";

afterEach(() => vi.unstubAllGlobals());
test("restarting and stopping highlights cancel the previous animation and clear classes", () => {
  const frames = new Map<number, FrameRequestCallback>();
  let nextId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++nextId, callback);
    return nextId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  const setClassName = vi.fn();
  const note = {
    start: new Beat(0),
    end: new Beat(4),
    tempo: { value: new Tempo(120) },
    glyph: { setClassName },
  };
  const highlighter = new NoteHighlighter(
    Object.assign(Object.create(Sheet.Score.prototype), {
      notes: [note],
      tempos: [],
    }) as Sheet.Score,
    { timer: { elapsedSeconds: { value: 1 } } } as Controller,
  );
  highlighter.highlight();
  highlighter.highlight();
  expect(frames.size).toBe(1);
  expect(setClassName).toHaveBeenLastCalledWith(["note-highlight"]);
  highlighter.stop();
  highlighter.stop();
  expect(frames.size).toBe(0);
  expect(highlighter.activeNotes.size).toBe(0);
  expect(setClassName).toHaveBeenLastCalledWith([]);
});
