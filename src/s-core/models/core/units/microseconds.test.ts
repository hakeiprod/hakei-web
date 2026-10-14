import { expect, it } from "vitest";
import { Microseconds } from "./microseconds";
import { TimeOffset } from "./time-offset";
it("keeps a signed difference between nonnegative instants", () => {
  expect(new Microseconds(0).difference(new Microseconds(1)).value).toBe(-1);
  expect(new TimeOffset(-1).add(new TimeOffset(2)).value).toBe(1);
});
it.each([-1, 0.5, Infinity, Number.NaN, Number.MAX_SAFE_INTEGER + 1])(
  "rejects invalid nonnegative integer %s",
  (value) => expect(() => new Microseconds(value)).toThrow(),
);
it.each([0.5, Infinity, Number.NaN, Number.MAX_SAFE_INTEGER + 1])(
  "rejects invalid signed integer %s",
  (value) => expect(() => new TimeOffset(value)).toThrow(),
);
