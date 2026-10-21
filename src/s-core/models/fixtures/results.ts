import type {
  FixtureDefinition,
  Result,
  Status,
  VerificationRun,
} from "./manifest";
import { canonical } from "./evaluate";
export function pendingResults(fixture: FixtureDefinition): Result[] {
  return [
    ...fixture.assertions,
    ...fixture.visualChecklist.map((item) => ({
      ...item,
      stage: "visual" as const,
    })),
  ].map((item) => ({
    fixtureId: fixture.id,
    assertionId: item.id,
    stage: item.stage,
    status: "pending",
    expected: item.expected,
    actual: null,
    message: "Not verified",
  }));
}
export function aggregateResults(
  fixture: FixtureDefinition,
  results: readonly Result[],
): Status {
  const expected = pendingResults(fixture).filter((item) =>
    fixture.requiredStages.includes(item.stage),
  );
  const current = expected.map(
    (item) =>
      results.find(
        (r) =>
          r.fixtureId === fixture.id &&
          r.stage === item.stage &&
          r.assertionId === item.assertionId,
      ) ?? item,
  );
  if (current.some((r) => r.status === "fail")) return "fail";
  if (current.some((r) => r.status === "error")) return "error";
  return current.length > 0 && current.every((r) => r.status === "pass")
    ? "pass"
    : "pending";
}
export function selectResults(
  fixture: FixtureDefinition,
  runs: readonly VerificationRun[],
  identity: Pick<
    VerificationRun,
    "sourceHash" | "expectationHash" | "rendererRevision" | "layout"
  >,
): Result[] {
  const matching = runs
    .filter(
      (run) =>
        run.fixtureId === fixture.id &&
        run.sourceHash === identity.sourceHash &&
        run.expectationHash === identity.expectationHash &&
        run.rendererRevision === identity.rendererRevision &&
        canonical(run.layout) === canonical(identity.layout),
    )
    .toSorted((a, b) => b.executedAt.localeCompare(a.executedAt));
  return pendingResults(fixture).map((item) => {
    // Select the latest run for this stage, never an older pass for a missing assertion.
    const run = matching.find((r) =>
      r.results.some((result) => result.stage === item.stage),
    );
    return (
      run?.results.find(
        (r) => r.assertionId === item.assertionId && r.stage === item.stage,
      ) ?? item
    );
  });
}
