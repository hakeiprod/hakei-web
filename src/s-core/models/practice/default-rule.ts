/** Immutable initial rule from the feature specification. */
export const defaultEvaluationRule = {
  id: "evaluation-v1",
  version: 1,
  practiceWindowUs: 150_000,
  perfectWindowUs: 30_000,
  goodWindowUs: 60_000,
  weights: { perfect: 1, good: 0.5 },
  extraPenalty: 1,
  status: "ACTIVE",
};
