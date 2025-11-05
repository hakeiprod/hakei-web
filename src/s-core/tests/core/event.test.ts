import { describe, expect, test } from "vitest";
import { Event } from "../../models/core/event";
import { Beat } from "../../models/core/units";

describe("isOverlapped", () => {
  test("partial overlap", () => {
    const event1 = new Event({ start: new Beat(0), duration: new Beat(4) });
    const event2 = new Event({ start: new Beat(2), duration: new Beat(4) });
    expect(event1.isOverlapped(event2)).toBe(true);
  });
  test("full overlap", () => {
    const event1 = new Event({ start: new Beat(0), duration: new Beat(4) });
    const event2 = new Event({ start: new Beat(0), duration: new Beat(4) });
    expect(event1.isOverlapped(event2)).toBe(true);
  });
  test("no overlap", () => {
    const event1 = new Event({ start: new Beat(0), duration: new Beat(4) });
    const event2 = new Event({ start: new Beat(4), duration: new Beat(4) });
    expect(event1.isOverlapped(event2)).toBe(false);
  });
});
