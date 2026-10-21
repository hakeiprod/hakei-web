import { expect, it } from "vitest";
import { Conditions } from "./conditions";
const input = {
  trackId: 0,
  rangeStartBar: 1,
  rangeEndBar: 2,
  tempoScale: 1,
  calibrationUs: -1_000_000,
  mode: "PRACTICE",
  ruleVersion: 1,
};
it("roundtrips conditions and retains signed calibration", () =>
  expect(Conditions.import(input).export()).toEqual(input));
it.each([
  { rangeStartBar: 0 },
  { rangeEndBar: 0 },
  { tempoScale: 0 },
  { calibrationUs: 1_000_001 },
  { trackId: -1 },
  { ruleVersion: 0 },
  { mode: "OTHER" },
  { unexpected: 1 },
])("rejects invalid conditions %j", (change) =>
  expect(() => Conditions.import({ ...input, ...change })).toThrow(),
);
