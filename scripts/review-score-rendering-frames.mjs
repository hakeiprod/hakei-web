/** Apply explicit image reviews to collected trace evidence, then aggregate measured values. */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
const { values } = parseArgs({
  options: {
    input: { type: "string" },
    reviews: { type: "string" },
    output: { type: "string" },
    phase: { type: "string", default: "diagnostic" },
    baseline: { type: "string" },
  },
});
for (const name of ["input", "reviews", "output"])
  if (!values[name]) throw new Error(`Missing --${name}`);
const readJSON = async (file) => JSON.parse(await readFile(file, "utf8"));
const data = await readJSON(values.input),
  reviews = await readJSON(values.reviews),
  directory = path.dirname(path.resolve(values.input));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const key = (result) =>
  `${result.fixture}-${result.layout}-${result.viewport.width}x${result.viewport.height}-${result.scale}-${result.run}`;
if (!["diagnostic", "before", "after"].includes(values.phase))
  throw new Error("INVALID_PHASE");
if (values.phase === "after" && !values.baseline)
  throw new Error("BASELINE_REQUIRED");
const baseline = values.baseline ? await readJSON(values.baseline) : null;
const used = new Set();
for (const result of data.results) {
  const selected = reviews.filter((review) => review.trial === key(result));
  let trace;
  if (selected.length > 0) {
    const bytes = await readFile(path.join(directory, result.trace));
    if (sha(bytes) !== result.traceSha256) throw new Error("TRACE_CHANGED");
    trace = JSON.parse(bytes).traceEvents;
  }
  for (const review of selected) {
    if (
      review.matchesExpectedState !== true ||
      typeof review.reason !== "string" ||
      !review.reason.trim()
    )
      throw new Error("EXPLICIT_STATE_REVIEW_REQUIRED");
    const evidence = result.evidence.find((entry) => entry.tag === review.tag);
    const candidate = evidence?.candidates?.find(
      (entry) =>
        entry.frameSequence === review.frameSequence &&
        entry.frameSource === review.frameSource &&
        entry.screenshotSha256 === review.screenshotSha256,
    );
    if (!candidate) throw new Error("UNKNOWN_REVIEWED_FRAME");
    const identity = key(result) + ":" + review.tag;
    if (used.has(identity)) throw new Error("DUPLICATE_REVIEW");
    used.add(identity);
    if (
      sha(await readFile(path.join(directory, candidate.frameImage))) !==
      candidate.screenshotSha256
    )
      throw new Error("IMAGE_CHANGED");
    const presented = trace.find(
      (event) =>
        event.name === "AnimationFrame::Presentation" &&
        event.args?.begin_frame_id?.sequence_number ===
          candidate.frameSequence &&
        event.args?.begin_frame_id?.source_id === candidate.frameSource,
    );
    if (
      !presented ||
      presented.ts / 1000 !== candidate.candidateFramePresented ||
      candidate.candidateFramePresented < evidence.stateCommitted
    )
      throw new Error("MISSING_PRESENTATION_PROOF");
    Object.assign(evidence, candidate, {
      framePresented: candidate.candidateFramePresented,
      frameReviewed: true,
      measurable: true,
      reviewReason: review.reason,
    });
  }
  const cold = result.evidence.find((entry) => entry.tag === "cold");
  result.coldMs =
    cold?.measurable && Number.isFinite(result.candidateReceivedTraceMs)
      ? cold.framePresented - result.candidateReceivedTraceMs
      : null;
  for (const input of result.inputs) {
    const action = result.actions.find((entry) => entry.inputId === input.id),
      evidence = result.evidence.find(
        (entry) => entry.tag === `action-${action?.index}`,
      );
    input.budgetMs = action?.budgetMs ?? 100;
    input.actionType = action?.type ?? null;
    input.measurable = Boolean(
      evidence?.measurable &&
      input.trusted &&
      Number.isFinite(input.inputReceivedTraceMs),
    );
    input.framePresented = input.measurable ? evidence.framePresented : null;
    input.responseMs = input.measurable
      ? input.framePresented - input.inputReceivedTraceMs
      : null;
    if (input.responseMs !== null && input.responseMs < 0)
      throw new Error("INVALID_CLOCK_MAPPING");
  }
  result.coldPass = result.coldMs !== null && result.coldMs <= 12_500;
  result.inputPass =
    result.actions.length > 0 &&
    result.actions.every((action) =>
      result.inputs.some(
        (input) =>
          input.id === action.inputId &&
          input.measurable &&
          input.responseMs <= (action.budgetMs ?? 100),
      ),
    );
  result.timingPass =
    result.status === "frame-review-required" &&
    result.fontPreloaded &&
    result.coldPass &&
    result.inputPass &&
    (!result.roundtrip || result.roundtrip.svgUnchanged === true);
  result.measurementStatus =
    result.coldMs === null ? "unmeasurable-or-cutoff" : "reviewed";
}
if (used.size !== reviews.length) throw new Error("UNUSED_REVIEW");
const groups = new Map();
for (const result of data.results) {
  const name = key({ ...result, run: 0 });
  const group = groups.get(name) ?? [];
  group.push(result);
  groups.set(name, group);
}
const statistics = (numbers) => {
  const sorted = numbers.toSorted((a, b) => a - b),
    n = sorted.length;
  return {
    count: n,
    maxMs: n ? sorted[n - 1] : null,
    medianMs: n
      ? (sorted[Math.floor((n - 1) / 2)] + sorted[Math.floor(n / 2)]) / 2
      : null,
  };
};
data.summary = {
  trials: data.results.length,
  cutoffs: data.results.filter((result) => result.status === "cutoff").length,
  failures: data.results.filter(
    (result) => result.status === "setup-or-action-failure",
  ).length,
  unmeasurable: data.results.filter((result) => result.coldMs === null).length,
  cold: statistics(
    data.results.flatMap((result) =>
      result.coldMs === null ? [] : [result.coldMs],
    ),
  ),
  redraws: statistics(
    data.results.flatMap((result) =>
      result.inputs
        .filter((input) => input.measurable && input.budgetMs === 6500)
        .map((input) => input.responseMs),
    ),
  ),
  pageNavigation: statistics(
    data.results.flatMap((result) =>
      result.inputs
        .filter((input) => input.measurable && input.actionType === "page")
        .map((input) => input.responseMs),
    ),
  ),
  inputs: statistics(
    data.results.flatMap((result) =>
      result.inputs
        .filter((input) => input.measurable && input.budgetMs <= 100)
        .map((input) => input.responseMs),
    ),
  ),
};
data.conditions = [...groups].map(([condition, group]) => {
  const stats = statistics(
    group.flatMap((result) => (result.coldMs === null ? [] : [result.coldMs])),
  );
  return {
    condition,
    trials: group.length,
    cutoffs: group.filter((result) => result.status === "cutoff").length,
    ...stats,
    nonWorseningThresholdMs:
      values.phase === "before" && stats.maxMs !== null
        ? Math.max(stats.maxMs * 1.2, stats.maxMs + 20)
        : (baseline?.conditions?.find((item) => item.condition === condition)
            ?.nonWorseningThresholdMs ?? null),
  };
});
data.phase = values.phase;
if (values.phase === "after") {
  if (
    baseline?.phase !== "before" ||
    baseline?.conditions?.length !== data.conditions.length
  )
    throw new Error("COMPLETE_MATCHING_BASELINE_REQUIRED");
  for (const condition of data.conditions) {
    const previous = baseline.conditions.find(
      (item) => item.condition === condition.condition,
    );
    if (!previous || previous.trials !== 5)
      throw new Error("COMPLETE_MATCHING_BASELINE_REQUIRED");
    // An all-cutoff reference has no finite non-worsening threshold. The
    // absolute budgets still apply to every improved trial in that condition.
    if (previous.nonWorseningThresholdMs === null) {
      if (previous.cutoffs !== 5 || previous.count !== 0)
        throw new Error("UNMEASURABLE_BASELINE_CONDITION");
    } else if (
      previous.count !== 5 ||
      !Number.isFinite(previous.nonWorseningThresholdMs)
    ) {
      throw new Error("UNMEASURABLE_BASELINE_CONDITION");
    }
  }
}
for (const condition of data.conditions)
  condition.nonWorseningPass =
    values.phase === "after" && condition.nonWorseningThresholdMs !== null
      ? condition.maxMs !== null &&
        condition.maxMs <= condition.nonWorseningThresholdMs
      : null;
data.validationPass =
  values.phase === "after" &&
  data.conditions.every(
    (condition) =>
      condition.trials === 5 &&
      condition.count === 5 &&
      condition.cutoffs === 0 &&
      (condition.nonWorseningThresholdMs === null ||
        condition.nonWorseningPass),
  ) &&
  data.results.every((result) => result.timingPass);
data.reviewRecord = {
  sha256: sha(await readFile(values.reviews)),
  reviewedImages: used.size,
};
await writeFile(values.output, JSON.stringify(data, null, 2) + "\n");
console.log(JSON.stringify(data.summary));
