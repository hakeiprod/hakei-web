import { expect, it } from "vitest";
import { Performance } from "./performance";
const event = {
  sequence: 0,
  type: "NOTE_ON",
  channel: 0,
  pitch: 60,
  velocity: 90,
  relativeUs: 0,
};
it("preserves unfinished events and protects the original and exports", () => {
  const input = [{ ...event }];
  const performance = Performance.import(input);
  input[0].pitch = 62;
  const output = performance.export();
  output[0].pitch = 64;
  expect(performance.export()).toEqual([event]);
  expect(Performance.import([]).export()).toEqual([]);
});
it.each([
  { pitch: 128 },
  { channel: 16 },
  { velocity: 0 },
  { relativeUs: -1 },
  { relativeUs: 1_801_200_001 },
  { unexpected: 1 },
])("rejects invalid event %j", (change) =>
  expect(() => Performance.import([{ ...event, ...change }])).toThrow(),
);
it("rejects duplicate sequences, backwards clocks and over-limit arrays", () => {
  expect(() => Performance.import([event, event])).toThrow();
  expect(() =>
    Performance.import([
      { ...event, relativeUs: 1 },
      { ...event, sequence: 1 },
    ]),
  ).toThrow();
  expect(() =>
    Performance.import(
      Array.from({ length: 100_001 }, (_, sequence) => ({
        ...event,
        sequence,
      })),
    ),
  ).toThrow();
});
