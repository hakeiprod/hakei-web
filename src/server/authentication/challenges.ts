import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { PrismaClient, Prisma } from "../../generated/prisma/client";
import { emailSchema } from "./input";
import { databaseNow } from "./rate-limit";
import { lockSession } from "./sessions";
import { providerAvailability } from "./providers";

type Purpose = "VERIFY" | "RESET" | "ADD_PASSWORD";
type Actor = { sub: string; sid: string; authVersion: number };
type ChallengeInput = {
  identityId: string;
  purpose: Purpose;
  emailSnapshot: string;
  userId?: string;
  authVersion?: number;
  issuerSid?: string;
  reauthIntentId?: string;
};
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const invalid = () => new Error("INVALID_CHALLENGE");

async function checkProof(
  tx: Prisma.TransactionClient,
  input: ChallengeInput,
  actor: Actor,
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  if (!providerAvailability(environment).github)
    throw new Error("AUTH_METHOD_UNAVAILABLE");
  await lockSession(tx, actor);
  const proof = input.reauthIntentId
    ? await tx.reauthIntent.findUnique({ where: { id: input.reauthIntentId } })
    : null;
  const now = await databaseNow(tx);
  if (
    !proof ||
    proof.userId !== actor.sub ||
    proof.currentSid !== actor.sid ||
    proof.authVersion !== actor.authVersion ||
    !proof.completedAt ||
    proof.consumedAt ||
    proof.revokedAt ||
    proof.expiresAt <= now
  )
    throw invalid();
  await tx.$queryRaw`SELECT "id" FROM "accounts" WHERE "provider" = 'github' AND "provider_account_id" = ${proof.providerAccountId} FOR SHARE`;
  const account = await tx.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "github",
        providerAccountId: proof.providerAccountId,
      },
    },
  });
  if (account?.userId !== actor.sub) throw invalid();
  return proof;
}
export function issueChallenge(database: PrismaClient, input: ChallengeInput) {
  return database.$transaction((tx) => issueChallengeInTransaction(tx, input));
}
export async function issueChallengeInTransaction(
  tx: Prisma.TransactionClient,
  input: ChallengeInput,
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  const emailSnapshot = emailSchema.parse(input.emailSnapshot);
  if (!["VERIFY", "RESET", "ADD_PASSWORD"].includes(input.purpose))
    throw invalid();
  if (input.userId)
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${input.userId} FOR SHARE`;
  const proof =
    input.purpose === "ADD_PASSWORD"
      ? await checkProof(
          tx,
          input,
          {
            sub: input.userId ?? "",
            sid: input.issuerSid ?? "",
            authVersion: input.authVersion ?? -1,
          },
          environment,
        )
      : null;
  await tx.$queryRaw`SELECT "id" FROM "EmailIdentity" WHERE "id" = ${input.identityId} FOR UPDATE`;
  const identity = await tx.emailIdentity.findUnique({
    where: { id: input.identityId },
  });
  if (!identity || identity.normalizedEmail !== emailSnapshot) throw invalid();
  if (
    input.purpose === "VERIFY" &&
    (identity.state !== "PENDING" || identity.userId)
  )
    throw invalid();
  if (input.purpose !== "VERIFY") {
    if (!input.userId || identity.userId !== input.userId) throw invalid();
    const user = await tx.user.findUnique({ where: { id: input.userId } });
    if (
      !user ||
      user.authVersion !== input.authVersion ||
      !user.email ||
      emailSchema.parse(user.email) !== emailSnapshot
    )
      throw invalid();
    if (
      input.purpose === "RESET" &&
      (identity.state !== "VERIFIED" ||
        !(await tx.passwordCredential.findUnique({
          where: { userId: input.userId },
        })))
    )
      throw invalid();
  }
  const id = randomUUID();
  await tx.$executeRaw`INSERT INTO "AuthChallengeHead" ("id", "identityId", "purpose", "generation") VALUES (${id}, ${input.identityId}, ${input.purpose}, 0) ON CONFLICT ("identityId", "purpose") DO NOTHING`;
  await tx.$queryRaw`SELECT "id" FROM "AuthChallengeHead" WHERE "identityId" = ${input.identityId} AND "purpose" = ${input.purpose} FOR UPDATE`;
  const head = await tx.authChallengeHead.update({
    where: {
      identityId_purpose: {
        identityId: input.identityId,
        purpose: input.purpose,
      },
    },
    data: { generation: { increment: 1 } },
  });
  const now = await databaseNow(tx);
  await tx.authChallenge.updateMany({
    where: { headId: head.id, consumedAt: null, revokedAt: null },
    data: { revokedAt: now },
  });
  const token = randomBytes(32).toString("base64url");
  const expiresAt =
    proof?.expiresAt ??
    new Date(
      now.getTime() +
        (input.purpose === "RESET" ? 30 * 60_000 : 24 * 60 * 60_000),
    );
  const challenge = await tx.authChallenge.create({
    data: {
      headId: head.id,
      generation: head.generation,
      tokenDigest: digest(token),
      emailSnapshot,
      userId: input.userId,
      authVersion: input.authVersion,
      issuerSid: input.issuerSid,
      reauthIntentId: input.reauthIntentId,
      expiresAt,
    },
  });
  return { id: challenge.id, token, expiresAt };
}
export async function consumeChallenge(
  tx: Prisma.TransactionClient,
  token: string,
  purpose: Purpose,
  actor?: Actor,
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  if (!/^[\w-]{43}$/u.test(token)) throw invalid();
  const snapshot = await tx.authChallenge.findUnique({
    where: { tokenDigest: digest(token) },
    include: { head: true },
  });
  if (!snapshot || snapshot.head.purpose !== purpose) throw invalid();
  if (snapshot.userId)
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${snapshot.userId} FOR UPDATE`;
  if (purpose === "ADD_PASSWORD") {
    if (
      !actor ||
      actor.sub !== snapshot.userId ||
      actor.sid !== snapshot.issuerSid ||
      actor.authVersion !== snapshot.authVersion
    )
      throw invalid();
    await checkProof(
      tx,
      {
        identityId: snapshot.head.identityId,
        purpose,
        emailSnapshot: snapshot.emailSnapshot,
        reauthIntentId: snapshot.reauthIntentId ?? undefined,
      },
      actor,
      environment,
    );
  }
  await tx.$queryRaw`SELECT "id" FROM "EmailIdentity" WHERE "id" = ${snapshot.head.identityId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "AuthChallengeHead" WHERE "id" = ${snapshot.headId} FOR UPDATE`;
  const current = await tx.authChallenge.findUniqueOrThrow({
    where: { id: snapshot.id },
    include: { head: { include: { identity: true } } },
  });
  const now = await databaseNow(tx);
  if (
    current.head.purpose !== purpose ||
    current.generation !== current.head.generation ||
    current.consumedAt ||
    current.revokedAt ||
    current.expiresAt <= now ||
    current.head.identity.normalizedEmail !== current.emailSnapshot
  )
    throw invalid();
  if (
    purpose === "VERIFY" &&
    (current.head.identity.userId || current.head.identity.state !== "PENDING")
  )
    throw invalid();
  if (current.userId) {
    const user = await tx.user.findUnique({ where: { id: current.userId } });
    if (
      !user ||
      user.authVersion !== current.authVersion ||
      current.head.identity.userId !== user.id ||
      !user.email ||
      emailSchema.parse(user.email) !== current.emailSnapshot
    )
      throw invalid();
  }
  const changed = await tx.authChallenge.updateMany({
    where: { id: current.id, consumedAt: null, revokedAt: null },
    data: { consumedAt: now },
  });
  if (changed.count !== 1) throw invalid();
  return current;
}
