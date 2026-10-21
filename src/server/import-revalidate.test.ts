import { expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { convertScore } from "@/s-core/models/import/convert";
import { signPreview, verifyPreview } from "./import-preview-token";
import { revalidateImport } from "./import-revalidate";
const secret = "test-secret-at-least-32-characters-long";
it("repairs a missing duration without original bytes and keeps the original expiry", async () => {
  const original = await convertScore({
    bytes: await readFile(
      "src/s-core/fixtures/import/missing-duration.musicxml",
    ),
    sourceName: "score.musicxml",
    options: { mode: "PRESERVE" },
  });
  const payload = {
    candidate: original.candidate,
    issues: original.issues,
    metadata: original.metadata,
  };
  const previewToken = signPreview("alice", payload, secret, 1000);
  const result = revalidateImport(
    "alice",
    {
      originalCandidate: payload.candidate,
      originalIssues: payload.issues,
      metadata: payload.metadata,
      previewToken,
      corrections: [{ kind: "NOTE", index: 0, duration: 1 }],
    },
    secret,
    2000,
  );
  expect(result.validation.canPractice).toBe(true);
  expect(
    verifyPreview(result.previewToken, "alice", result, secret, 2001).expiresAt,
  ).toBe(1_801_000);
});
it("rejects deletion of signed diagnostics and unsupported correction fields", async () => {
  const original = await convertScore({
    bytes: await readFile("src/s-core/fixtures/import/repeat.musicxml"),
    sourceName: "score.musicxml",
    options: { mode: "PRESERVE" },
  });
  const payload = {
    candidate: original.candidate,
    issues: original.issues,
    metadata: original.metadata,
  };
  const input = {
    originalCandidate: payload.candidate,
    originalIssues: payload.issues,
    metadata: payload.metadata,
    previewToken: signPreview("alice", payload, secret, 1000),
    corrections: [{ kind: "NOTE", index: 0, pitch: 62 }],
  };
  expect(() =>
    revalidateImport("alice", { ...input, originalIssues: [] }, secret, 2000),
  ).toThrow("INVALID_PREVIEW_TOKEN");
  expect(() =>
    revalidateImport(
      "alice",
      {
        ...input,
        corrections: [{ kind: "NOTE", index: 0, canPractice: true }],
      },
      secret,
      2000,
    ),
  ).toThrow();
  expect(
    revalidateImport("alice", input, secret, 2000).validation.canPractice,
  ).toBe(false);
});

it("retains actual source version and first expiry through correction", async () => {
  const original = await convertScore({
    bytes: await readFile(
      "src/s-core/fixtures/import/musicxml-versions/study-3.1.mxl",
    ),
    options: { mode: "PRESERVE" },
  });
  const token = signPreview("alice", original, secret, 1000);
  const result = revalidateImport(
    "alice",
    {
      originalCandidate: original.candidate,
      originalIssues: original.issues,
      metadata: original.metadata,
      previewToken: token,
      corrections: [{ kind: "NOTE", index: 2, pitch: 63 }],
    },
    secret,
    2000,
  );
  expect(result.metadata).toEqual(original.metadata);
  expect(result.metadata.formatVersion).toBe("3.1");
  expect(
    verifyPreview(result.previewToken, "alice", result, secret, 2001).expiresAt,
  ).toBe(1_801_000);
});

it("retains original spelling for timing edits and explicitly reinfers it after pitch correction", async () => {
  const original = await convertScore({
    bytes: await readFile(
      "src/s-core/fixtures/notation/accidentals/parentheses.musicxml",
    ),
    sourceName: "parentheses.musicxml",
    options: { mode: "PRESERVE" },
  });
  const input = {
    originalCandidate: original.candidate,
    originalIssues: original.issues,
    metadata: original.metadata,
    previewToken: signPreview("alice", original, secret, 1000),
  };
  const timing = revalidateImport(
    "alice",
    { ...input, corrections: [{ kind: "NOTE", index: 0, duration: 2 }] },
    secret,
    2000,
  );
  expect(timing.candidate.notes[0].explicitAccidental).toEqual(
    original.candidate.notes[0].explicitAccidental,
  );
  const pitch = revalidateImport(
    "alice",
    { ...input, corrections: [{ kind: "NOTE", index: 0, pitch: 65 }] },
    secret,
    2000,
  );
  expect(pitch.candidate.notes[0].notatedPitch).toBeUndefined();
  expect(
    pitch.issues.some((index) => index.code === "NOTATION_REINFERRED"),
  ).toBe(true);
  expect(original.candidate.notes[0].notatedPitch).toEqual({
    step: "C",
    octave: 4,
    alter: 1,
  });
});
