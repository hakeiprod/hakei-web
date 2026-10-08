import { describe, expect, test } from "vitest";
import { TempoMap } from "./tempo-map";
import { Tempo } from "./tempo";
import { Beat, Tempo as TempoValue } from "./units";

const change = (start: number, bpm: number) =>
  new Tempo({
    start: new Beat(start),
    duration: new Beat(0),
    value: new TempoValue(bpm),
  });

describe("TempoMap", () => {
  test("constant tempo keeps the existing conversion", () => {
    const map = new TempoMap([change(0, 120)]);
    expect(map.beatToSeconds(new Beat(8)).value).toBe(4);
  });
  test("integrates earlier tempo segments at and after a change", () => {
    const map = new TempoMap([change(0, 120), change(4, 60), change(8, 240)]);
    expect(map.beatToSeconds(new Beat(0)).value).toBe(0);
    expect(map.beatToSeconds(new Beat(4)).value).toBe(2);
    expect(map.beatToSeconds(new Beat(6)).value).toBe(4);
    expect(map.beatToSeconds(new Beat(8)).value).toBe(6);
    expect(map.beatToSeconds(new Beat(12)).value).toBe(7);
  });
  test("a sustained note spanning tempo changes uses both endpoints", () => {
    const map = new TempoMap([change(0, 120), change(4, 60), change(8, 240)]);
    expect(map.durationToSeconds(new Beat(3), new Beat(9)).value).toBe(4.75);
  });
  test("sorts changes without mutating the caller's array", () => {
    const tempos = [change(4, 60), change(0, 120)];
    const map = new TempoMap(tempos);
    expect(map.beatToSeconds(new Beat(6)).value).toBe(4);
    expect(tempos[0].start.value).toBe(4);
  });
  test("uses the default tempo before the first change and for an empty timeline", () => {
    expect(new TempoMap([]).beatToSeconds(new Beat(4)).value).toBe(2);
    const map = new TempoMap([change(4, 60)]);
    expect(map.beatToSeconds(new Beat(6)).value).toBe(4);
    expect(
      new TempoMap([], new TempoValue(60)).beatToSeconds(new Beat(4)).value,
    ).toBe(4);
  });
  test("uses the last change at a shared beat and extrapolates the final tempo", () => {
    const map = new TempoMap([change(0, 120), change(4, 90), change(4, 60)]);
    expect(map.beatToSeconds(new Beat(6)).value).toBe(4);
    expect(map.beatToSeconds(new Beat(20)).value).toBe(18);
  });
});
