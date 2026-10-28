import { afterEach, expect, test, vi } from "vitest";
import type { Controller } from "../browser/audio";
import { Beat, Tempo } from "../core/units";
import * as Engraving from "../engraving";
import { NoteHighlighter } from "./note-highlighter";
import { drainSteps } from "../sheet/render-steps";

const makeScore = () =>
  ({
    notes: [0, 0, 1, 4].map((start, index) => {
      const glyph = {
        classList: [] as string[],
        setClassName: (value: string[]) => {
          glyph.classList = value;
        },
      };
      return {
        start: new Beat(start),
        end: new Beat(start + 1),
        tempo: { value: new Tempo(index % 2 ? 60 : 120) },
        rest: index === 1,
        glyph,
      };
    }),
  }) as unknown as Engraving.Score;

test("prepares exactly the existing zero-second highlight without an audio controller or animation", () => {
  const request = vi.fn();
  vi.stubGlobal("requestAnimationFrame", request);
  const prepared = makeScore(),
    existing = makeScore();
  drainSteps(NoteHighlighter.initialSteps(prepared));
  const highlighter = new NoteHighlighter(existing, {
    timer: { elapsedSeconds: { value: 0 } },
  } as Controller);
  highlighter.highlight(false);
  expect(prepared.notes.map((n) => n.glyph.classList)).toEqual(
    existing.notes.map((n) => n.glyph.classList),
  );
  expect(prepared.notes.map((n) => n.glyph.classList)).toEqual([
    ["note-highlight"],
    ["note-highlight"],
    [],
    [],
  ]);
  expect(request).not.toHaveBeenCalled();
});

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
    glyph: { classList: [], setClassName },
  };
  const highlighter = new NoteHighlighter(
    Object.assign(Object.create(Engraving.Score.prototype), {
      notes: [note],
      tempos: [],
    }) as Engraving.Score,
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

test("static highlighting keeps the current music state without scheduling frames", () => {
  const request = vi.fn(() => 1);
  vi.stubGlobal("requestAnimationFrame", request);
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const setClassName = vi.fn();
  const timer = { elapsedSeconds: { value: 0 } };
  const note = {
    start: new Beat(0),
    end: new Beat(4),
    tempo: { value: new Tempo(120) },
    glyph: { classList: [], setClassName },
  };
  const highlighter = new NoteHighlighter(
    { notes: [note] } as unknown as Engraving.Score,
    { timer } as Controller,
  );
  highlighter.highlight(false);
  expect(setClassName).toHaveBeenLastCalledWith(["note-highlight"]);
  expect(request).not.toHaveBeenCalled();
  highlighter.highlight();
  expect(request).toHaveBeenCalledOnce();
  timer.elapsedSeconds.value = 10;
  highlighter.highlight(false);
  expect(highlighter.activeNotes.size).toBe(0);
  expect(setClassName).toHaveBeenLastCalledWith([]);
  expect(request).toHaveBeenCalledOnce();
  timer.elapsedSeconds.value = 0;
  highlighter.highlight(false);
  expect(setClassName).toHaveBeenLastCalledWith(["note-highlight"]);
  expect(request).toHaveBeenCalledOnce();
  highlighter.stop();
  expect(highlighter.activeNotes.size).toBe(0);
});

test("suspending a retained drawing cancels animation without repainting its glyph classes", () => {
  const request = vi.fn(() => 1),
    cancel = vi.fn(),
    setClassName = vi.fn();
  vi.stubGlobal("requestAnimationFrame", request);
  vi.stubGlobal("cancelAnimationFrame", cancel);
  const note = {
    start: new Beat(0),
    end: new Beat(4),
    tempo: { value: new Tempo(120) },
    glyph: { classList: [], setClassName },
  };
  const highlighter = new NoteHighlighter(
    { notes: [note] } as unknown as Engraving.Score,
    { timer: { elapsedSeconds: { value: 0 } } } as Controller,
  );
  highlighter.highlight();
  setClassName.mockClear();
  highlighter.stop({ preserveClasses: true });
  expect(cancel).toHaveBeenCalledWith(1);
  expect(setClassName).not.toHaveBeenCalled();
  highlighter.controller.timer.elapsedSeconds.value = 10;
  highlighter.highlight(false);
  expect(setClassName).toHaveBeenLastCalledWith([]);
  expect(highlighter.activeNotes.size).toBe(0);
});

test("a new highlighter removes retained colors that no longer match the playback time", () => {
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const glyph = {
    classList: ["note-highlight"],
    setClassName: vi.fn((classes: string[]) => {
      glyph.classList = classes;
    }),
  };
  const note = {
    start: new Beat(0),
    end: new Beat(4),
    tempo: { value: new Tempo(120) },
    glyph,
  };
  const highlighter = new NoteHighlighter(
    { notes: [note] } as unknown as Engraving.Score,
    { timer: { elapsedSeconds: { value: 10 } } } as Controller,
  );
  highlighter.highlight(false);
  expect(glyph.classList).toEqual([]);
  expect(highlighter.activeNotes.size).toBe(0);
});
