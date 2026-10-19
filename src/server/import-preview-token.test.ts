import { expect, it } from "vitest";
import { signPreview, verifyPreview } from "./import-preview-token";
const data = {
  candidate: { note: 60 },
  issues: [],
  metadata: { converterVersion: "v1" },
};
const secret = "test-secret-at-least-32-characters-long";
it("binds actor, every payload section, converter and expiration", () => {
  const token = signPreview("alice", data, secret, 1000);
  expect(verifyPreview(token, "alice", data, secret, 1001).expiresAt).toBe(
    1_801_000,
  );
  for (const [actor, payload] of [
    ["bob", data],
    ["alice", { ...data, candidate: { note: 61 } }],
    ["alice", { ...data, issues: ["removed"] }],
    ["alice", { ...data, metadata: { converterVersion: "v2" } }],
  ] as const)
    expect(() => verifyPreview(token, actor, payload, secret, 1001)).toThrow(
      "INVALID_PREVIEW_TOKEN",
    );
  expect(() => verifyPreview(token, "alice", data, secret, 1_801_000)).toThrow(
    "PREVIEW_EXPIRED",
  );
});
it("rejects altered signatures and never extends initial expiry", () => {
  const token = signPreview("alice", data, secret, 1000);
  expect(() =>
    verifyPreview(token.slice(0, -1) + "!", "alice", data, secret, 2000),
  ).toThrow();
  const expiry = verifyPreview(token, "alice", data, secret, 2000).expiresAt;
  const resigned = signPreview("alice", data, secret, 2000, expiry);
  expect(verifyPreview(resigned, "alice", data, secret, 2001).expiresAt).toBe(
    expiry,
  );
  expect(() =>
    signPreview("alice", data, secret, 2000, 2000 + 1_800_001),
  ).toThrow();
});
it("does not include candidate music or original bytes in tokens", () => {
  const token = signPreview("alice", data, secret, 1000);
  const contents = JSON.parse(
    Buffer.from(token.split(".")[0], "base64url").toString(),
  );
  expect(contents).not.toHaveProperty("candidate");
  expect(contents).not.toHaveProperty("bytes");
  expect(() => signPreview("alice", data, "short", 1000)).toThrow(
    "IMPORT_SIGNING_SECRET_REQUIRED",
  );
});

it("accepts an unchanged v1 preview but rejects source-version-only tampering", () => {
  const payload = {
    ...data,
    metadata: { converterVersion: "score-import-v1", formatVersion: "3.1" },
  };
  const token = signPreview("alice", payload, secret, 1000);
  expect(verifyPreview(token, "alice", payload, secret, 1001)).toBeDefined();
  const tampered = {
    ...payload,
    metadata: { ...payload.metadata, formatVersion: "4.0" },
  };
  expect(() => verifyPreview(token, "alice", tampered, secret, 1001)).toThrow(
    "INVALID_PREVIEW_TOKEN",
  );
});
