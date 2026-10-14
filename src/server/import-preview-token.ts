import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { payloadHash } from "./contracts";
const lifetime = 30 * 60 * 1000;
const claimsSchema = z
  .object({
    purpose: z.literal("score-import-preview-v1"),
    actorId: z.string().min(1),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    converterVersion: z.string().min(1),
    expiresAt: z.number().int().positive(),
  })
  .strict();
interface PreviewPayload {
  candidate: unknown;
  issues: unknown;
  metadata: { converterVersion: string };
}
function signingSecret(secret: string | undefined) {
  if (!secret || Buffer.byteLength(secret) < 32)
    throw new Error("IMPORT_SIGNING_SECRET_REQUIRED");
  return secret;
}
export function signPreview(
  actorId: string,
  payload: PreviewPayload,
  secret = process.env.IMPORT_PREVIEW_SECRET,
  now = Date.now(),
  expiresAt = now + lifetime,
) {
  if (
    !Number.isSafeInteger(now) ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= now ||
    expiresAt > now + lifetime
  )
    throw new Error("INVALID_PREVIEW_EXPIRY");
  const claims = claimsSchema.parse({
    purpose: "score-import-preview-v1",
    actorId,
    hash: payloadHash({
      candidate: payload.candidate,
      issues: payload.issues,
      metadata: payload.metadata,
    }),
    converterVersion: payload.metadata.converterVersion,
    expiresAt,
  });
  const encoded = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", signingSecret(secret))
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}
export function verifyPreview(
  token: string,
  actorId: string,
  payload: PreviewPayload,
  secret = process.env.IMPORT_PREVIEW_SECRET,
  now = Date.now(),
) {
  const key = signingSecret(secret);
  if (token.length > 4096) throw new Error("INVALID_PREVIEW_TOKEN");
  const sections = token.split(".");
  if (
    sections.length !== 2 ||
    !sections.every((section) => /^[A-Za-z0-9_-]+$/.test(section))
  )
    throw new Error("INVALID_PREVIEW_TOKEN");
  const [encoded, signature] = sections;
  const actual = Buffer.from(signature, "base64url");
  const expected = createHmac("sha256", key).update(encoded).digest();
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new Error("INVALID_PREVIEW_TOKEN");
  let claims: z.infer<typeof claimsSchema>;
  try {
    claims = claimsSchema.parse(
      JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")),
    );
  } catch {
    throw new Error("INVALID_PREVIEW_TOKEN");
  }
  if (
    claims.actorId !== actorId ||
    claims.hash !==
      payloadHash({
        candidate: payload.candidate,
        issues: payload.issues,
        metadata: payload.metadata,
      }) ||
    claims.converterVersion !== payload.metadata.converterVersion
  )
    throw new Error("INVALID_PREVIEW_TOKEN");
  if (now >= claims.expiresAt) throw new Error("PREVIEW_EXPIRED");
  return claims;
}
