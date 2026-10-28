import { createHash } from "node:crypto";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function frameEvidence(trace, stateName, stopName) {
  const state = trace.find((event) => event.name === stateName),
    stop = stopName
      ? trace.find((event) => event.name === stopName)
      : {
          ts: trace.reduce(
            (maximum, event) => Math.max(maximum, event.ts ?? 0),
            0,
          ),
        };
  if (!state || !stop)
    return { measurable: false, reason: "missing-state-or-capture" };
  const screenshots = trace.filter(
    (event) =>
      event.name === "Screenshot" &&
      event.ts >= state.ts &&
      event.ts <= stop.ts,
  );
  const candidates = [];
  for (const screenshot of screenshots) {
    const frame = screenshot.args;
    const presented = trace.find(
      (event) =>
        event.name === "AnimationFrame::Presentation" &&
        event.args?.begin_frame_id?.sequence_number === frame.frame_sequence &&
        event.args?.begin_frame_id?.source_id === frame.source_id &&
        event.ts >= state.ts,
    );
    if (presented)
      candidates.push({
        measurable: false,
        reason: "frame-review-required",
        stateCommitted: state.ts / 1000,
        candidateFramePresented: presented.ts / 1000,
        frameSequence: frame.frame_sequence,
        frameSource: frame.source_id,
        frameScreenshotTimestamp: screenshot.ts,
        screenshotSha256: sha(Buffer.from(frame.snapshot, "base64")),
        frameReviewed: false,
      });
  }
  return {
    measurable: false,
    reason:
      candidates.length > 0 ? "frame-review-required" : "missing-presentation",
    stateCommitted: state.ts / 1000,
    candidates,
    ...candidates[0],
  };
}
