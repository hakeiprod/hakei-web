// @vitest-environment node
import { expect, test } from "vitest";
import {
  calculateTrust,
  adjustmentForTarget,
  trustRuleSchema,
} from "./trust-calculation";
const rule = {
  initialScore: 10,
  wAdmin: 2,
  wOutcome: 3,
  wReview: 4,
  acceptedDelta: 5,
  rejectedDelta: -2,
  reviewFactor: 0.5,
  minReview: -1,
  maxReview: 1,
  minScore: 0,
  maxScore: 100,
  mergeThreshold: 50,
};
test("declarative weights and clamp are deterministic", () => {
  expect(
    calculateTrust(rule, {
      adjustment: 1,
      accepted: 2,
      rejected: 1,
      reviews: 3,
    }),
  ).toBe(42);
  expect(
    calculateTrust(rule, {
      adjustment: 100,
      accepted: 0,
      rejected: 0,
      reviews: 0,
    }),
  ).toBe(100);
  expect(
    calculateTrust(rule, {
      adjustment: -100,
      accepted: 0,
      rejected: 0,
      reviews: 0,
    }),
  ).toBe(0);
});
test("target adjustment inverts non-unit administrative weight, including clamped inputs", () => {
  const inputs = { adjustment: 100, accepted: 2, rejected: 1, reviews: 3 };
  const delta = adjustmentForTarget(rule, inputs, 50);
  expect(
    calculateTrust(rule, { ...inputs, adjustment: inputs.adjustment + delta }),
  ).toBe(50);
  expect(() => adjustmentForTarget(rule, inputs, 101)).toThrow();
});
test("rule rejects nonfinite values, invalid weights and thresholds", () => {
  for (const change of [
    { wAdmin: 0 },
    { wReview: -1 },
    { minScore: 11 },
    { mergeThreshold: 101 },
    { initialScore: Number.POSITIVE_INFINITY },
    { minReview: 2 },
  ]) {
    expect(trustRuleSchema.safeParse({ ...rule, ...change }).success).toBe(
      false,
    );
  }
});
