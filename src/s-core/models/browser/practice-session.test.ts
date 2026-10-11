import { expect, test } from "vitest";
import * as Core from "../core";
import "../core/extensions/to-sheet";
import { Score, Controller } from "../engraving";
import { LayoutType } from "../sheet";
import { PracticeSession } from "./practice-session";

function prepare(notes: { pitch: number; start: number; duration: number }[]) {
  const score = Score.import(
    Core.Score.create({ tracks: [{ notes }] })
      .toSheet()
      .export(),
  );
  new Controller(score, {
    scale: 12,
    layoutType: LayoutType.Horizontal,
    debug: false,
    advanced: true,
  }).mount();
  return { score, session: new PracticeSession(score.notes) };
}
test("only the expected pitch advances and highlights notes, ignoring rests", () => {
  const { score, session } = prepare([
    { pitch: 60, start: 1, duration: 1 },
    { pitch: 62, start: 3, duration: 1 },
  ]);
  expect(session.total).toBe(2);
  expect(session.press(62)).toBe(false);
  session.release(62);
  expect(session.press(60)).toBe(true);
  expect(session.completed).toBe(1);
  expect(
    score.notes.find((note) => !note.rest && note.pitch.value === 60)!.glyph
      .classList,
  ).toContain("note-highlight");
  expect(session.press(62)).toBe(true);
  expect(session.completed).toBe(2);
});
test("a chord requires every distinct pitch, in any input order", () => {
  const { session } = prepare(
    [60, 64, 67].map((pitch) => ({ pitch, start: 0, duration: 1 })),
  );
  session.press(67);
  session.press(60);
  expect(session.completed).toBe(0);
  session.press(64);
  expect(session.completed).toBe(1);
});
test("holding a key cannot consume repeated notes and reset clears only practice highlights", () => {
  const { session, score } = prepare(
    [0, 1].map((start) => ({ pitch: 60, start, duration: 1 })),
  );
  score.notes[0].glyph.setClassName(["custom"]);
  session.press(60);
  expect(session.press(60)).toBe(false);
  expect(session.completed).toBe(1);
  session.release(60);
  session.press(60);
  expect(session.completed).toBe(2);
  session.reset();
  expect(session.completed).toBe(0);
  expect(score.notes[0].glyph.classList).toEqual(["custom"]);
  expect(score.notes[1].glyph.classList).not.toContain("note-highlight");
});
