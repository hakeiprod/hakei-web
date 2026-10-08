import { expect, test } from "vitest";
import { Beat, Tempo as TempoValue } from "../core/units";
import { Tempo } from "../core/tempo";
import { TempoMap } from "../core/tempo-map";
import { Seconds } from "../files/soundfont2/units/seconds";
import { JudgeType } from "./enums/judge";
import { Note } from "./note";

test("rhythm judgement uses the same absolute timeline as playback", () => {
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
  const note = Object.assign(Object.create(Note.prototype), {
    _start: new Beat(6),
    score: { tempoMap: map },
    hitSeconds: new Seconds(4),
  }) as Note;
  expect(note.canHit(new Seconds(4))).toBe(true);
  expect(note.judge).toBe(JudgeType.Perfect);
  note.hitSeconds = new Seconds(4.4);
  expect(note.judge).toBe(JudgeType.Good);
  note.hitSeconds = new Seconds(5.1);
  expect(note.judge).toBe(JudgeType.Miss);
  expect(note.canHit(new Seconds(6))).toBe(false);
});
