import { expect, test } from "vitest";
import { Note } from "./note";
import { Score } from "./score";
import { Note as AudioNote } from "../audio/note";
test("retains absent sounding pitch without synthesizing MIDI zero", () => {
  const json = {
    id: 1,
    trackId: 0,
    pitch: null,
    start: 0,
    duration: 1,
    end: 1,
    velocity: 80,
  };
  expect(Note.import(json).export()).toEqual(json);
  expect(() => AudioNote.import({ ...json, masterbarId: 0 })).toThrow(
    /Unpitched/,
  );
  const s = Score.create({
    tracks: [{ notes: [{ pitch: 60, start: 0, duration: 1 }] }],
  });
  s.notes[0].pitch = null;
  expect(s.keyRange).toBeNull();
});
