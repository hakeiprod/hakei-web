import { z } from "zod";
const finite = z.number().finite();
export const trustRuleSchema = z
  .object({
    initialScore: finite,
    wAdmin: finite.positive(),
    wOutcome: finite.nonnegative(),
    wReview: finite.nonnegative(),
    acceptedDelta: finite,
    rejectedDelta: finite,
    reviewFactor: finite,
    minReview: finite,
    maxReview: finite,
    minScore: finite,
    maxScore: finite,
    mergeThreshold: finite,
  })
  .superRefine((rule, context) => {
    if (
      rule.minScore > rule.maxScore ||
      rule.minReview > rule.maxReview ||
      rule.initialScore < rule.minScore ||
      rule.initialScore > rule.maxScore ||
      rule.mergeThreshold < rule.minScore ||
      rule.mergeThreshold > rule.maxScore
    ) {
      context.addIssue({
        code: "custom",
        message: "Invalid score/review bounds",
      });
    }
  });
export type TrustRule = z.infer<typeof trustRuleSchema>;
export type TrustInputs = {
  adjustment: number;
  accepted: number;
  rejected: number;
  reviews: number;
};
function components(rule: TrustRule, inputs: TrustInputs) {
  trustRuleSchema.parse(rule);
  for (const value of Object.values(inputs))
    if (!Number.isFinite(value)) throw new Error("INVALID_TRUST_INPUT");
  if (
    !Number.isSafeInteger(inputs.accepted) ||
    inputs.accepted < 0 ||
    !Number.isSafeInteger(inputs.rejected) ||
    inputs.rejected < 0
  )
    throw new Error("INVALID_TRUST_INPUT");
  const base =
    rule.initialScore +
    rule.wOutcome *
      (rule.acceptedDelta * inputs.accepted +
        rule.rejectedDelta * inputs.rejected) +
    rule.wReview * rule.reviewFactor * inputs.reviews;
  if (!Number.isFinite(base)) throw new Error("TRUST_OVERFLOW");
  return base;
}
export function calculateTrust(rule: TrustRule, inputs: TrustInputs) {
  const value = components(rule, inputs) + rule.wAdmin * inputs.adjustment;
  if (!Number.isFinite(value)) throw new Error("TRUST_OVERFLOW");
  return Math.max(rule.minScore, Math.min(rule.maxScore, value));
}
export function adjustmentForTarget(
  rule: TrustRule,
  inputs: TrustInputs,
  target: number,
) {
  const base = components(rule, inputs);
  if (
    !Number.isFinite(target) ||
    target < rule.minScore ||
    target > rule.maxScore
  )
    throw new Error("INVALID_TARGET_SCORE");
  const delta = (target - base) / rule.wAdmin - inputs.adjustment;
  if (!Number.isFinite(delta)) throw new Error("TRUST_OVERFLOW");
  return delta;
}
