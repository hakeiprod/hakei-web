import { expect, it } from "vitest";
import { TempoMap } from "./tempo-map";
import { Beat } from "../core/units/beat";
it("retains fractional absolute times and rounds after subtracting origin", () => {
  const map = new TempoMap(
    [
      { start: 0, value: 137 },
      { start: 4, value: 83 },
    ],
    1.3,
  );
  const origin = map.microsecondsAt(new Beat(4));
  const end = map.microsecondsAt(new Beat(5));
  expect(Number.isInteger(origin)).toBe(false);
  expect(Math.round(end - origin)).toBe(Math.round(60_000_000 / (83 * 1.3)));
});
it("rejects invalid tempo maps", () => {
  for (const value of [
    [],
    [{ start: 1, value: 120 }],
    [{ start: 0, value: 0 }],
    [
      { start: 0, value: 120 },
      { start: 0, value: 60 },
    ],
  ])
    expect(() => new TempoMap(value, 1)).toThrow();
});
