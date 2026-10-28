import { expect, test } from "vitest";
import { frameEvidence } from "./score-rendering-frame-evidence.mjs";

const screenshot = {
  name: "Screenshot",
  ts: 1500,
  args: {
    frame_sequence: 7,
    source_id: 3,
    snapshot: Buffer.from("frame").toString("base64"),
  },
};
const presented = {
  name: "AnimationFrame::Presentation",
  ts: 1600,
  args: { begin_frame_id: { sequence_number: 7, source_id: 3 } },
};
const state = { name: "committed", ts: 1000 };
const stop = { name: "captured", ts: 2000 };

test("matching presentation remains unmeasurable until an explicit image review", () => {
  const evidence = frameEvidence(
    [state, screenshot, presented, stop],
    "committed",
    "captured",
  );
  if (!("candidates" in evidence)) throw new Error("Missing frame evidence");
  expect(evidence.measurable).toBe(false);
  expect(evidence.frameReviewed).toBe(false);
  expect(evidence.candidates).toHaveLength(1);
  expect(evidence.stateCommitted).toBe(1);
  expect(evidence.candidateFramePresented).toBe(1.6);
});

test.each(["sequence", "source", "before-commit", "after-capture"])(
  "never accepts a %s frame as presentation proof",
  (mismatch) => {
    const image = structuredClone(screenshot);
    if (mismatch === "sequence") image.args.frame_sequence++;
    if (mismatch === "source") image.args.source_id++;
    if (mismatch === "before-commit") image.ts = 999;
    if (mismatch === "after-capture") image.ts = 2001;
    const evidence = frameEvidence(
      [state, image, presented, stop],
      "committed",
      "captured",
    );
    if (!("candidates" in evidence)) throw new Error("Missing frame evidence");
    expect(evidence.measurable).toBe(false);
    expect(evidence.candidates).toHaveLength(0);
  },
);

test("missing state or capture cannot become a successful measurement", () => {
  expect(
    frameEvidence([screenshot, presented, stop], "committed", "captured")
      .measurable,
  ).toBe(false);
  expect(
    frameEvidence([state, screenshot, presented], "committed", "captured")
      .measurable,
  ).toBe(false);
});
