import "server-only";
import { z } from "zod";
import type { PrismaClient, Prisma } from "../../generated/prisma/client";
import type { authenticationConfig } from "./config";
import type { GithubActor } from "./github-reauth";
import { providerAvailability } from "./providers";
import { lockSession, revokeAllSessions } from "./sessions";
import { databaseNow, reserveSend } from "./rate-limit";
import { emailSchema, passwordSchema } from "./input";
import { issueChallengeInTransaction, consumeChallenge } from "./challenges";
import { authenticationMailer } from "./mail";
import { hashPassword } from "./password";
import { recordPasswordChange } from "./notices";
import { registrationAccepted } from "./registration";
type Environment = Readonly<Record<string, string | undefined>>;
type Configuration = Extract<
  ReturnType<typeof authenticationConfig>,
  { enabled: true }
>;
function enabled(environment: Environment) {
  if (!providerAvailability(environment).github)
    throw new Error("AUTH_METHOD_UNAVAILABLE");
}
async function additionOwner(tx: Prisma.TransactionClient, actor: GithubActor) {
  await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${actor.sub} FOR UPDATE`;
  await lockSession(tx, actor);
  const user = await tx.user.findUniqueOrThrow({
    where: { id: actor.sub },
    include: {
      passwordCredential: true,
      emailIdentity: true,
      accounts: { where: { provider: "github" } },
    },
  });
  if (user.passwordCredential) throw new Error("PASSWORD_ALREADY_SET");
  if (
    !user.email ||
    !user.emailIdentity ||
    user.emailIdentity.state !== "OAUTH_BOUND" ||
    user.emailIdentity.normalizedEmail !== emailSchema.parse(user.email)
  )
    throw new Error("EMAIL_REQUIRED");
  if (user.accounts.length !== 1) throw new Error("AUTH_METHOD_UNAVAILABLE");
  return user;
}
export async function requestPasswordAddition(
  database: PrismaClient,
  config: Configuration,
  actor: GithubActor,
  environment: Environment,
  source: string,
  mailer: Pick<
    ReturnType<typeof authenticationMailer>,
    "sendChallenge"
  > = authenticationMailer(config),
) {
  enabled(environment);
  const snapshot = await database.user.findUnique({
    where: { id: actor.sub },
    select: { email: true },
  });
  if (!snapshot?.email) throw new Error("EMAIL_REQUIRED");
  const email = emailSchema.parse(snapshot.email);
  await reserveSend(database, {
    mailbox: email,
    source,
    secret: config.rateSecret,
    mailboxLimit: config.limits.sendMailbox,
    sourceLimit: config.limits.sendSource,
  });
  const challenge = await database.$transaction(async (tx) => {
    const user = await additionOwner(tx, actor);
    const now = await databaseNow(tx);
    const proof = await tx.reauthIntent.findFirst({
      where: {
        userId: actor.sub,
        currentSid: actor.sid,
        authVersion: actor.authVersion,
        completedAt: { not: null },
        consumedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
        providerAccountId: user.accounts[0].providerAccountId,
      },
      orderBy: { completedAt: "desc" },
    });
    if (!proof || emailSchema.parse(user.email) !== email)
      throw new Error("REAUTHENTICATION_REQUIRED");
    enabled(environment);
    return issueChallengeInTransaction(
      tx,
      {
        identityId: user.emailIdentity!.id,
        purpose: "ADD_PASSWORD",
        emailSnapshot: email,
        userId: user.id,
        authVersion: actor.authVersion,
        issuerSid: actor.sid,
        reauthIntentId: proof.id,
      },
      environment,
    );
  });
  let accepted = false;
  try {
    const result = await mailer.sendChallenge(
      email,
      challenge.token,
      "ADD_PASSWORD",
    );
    accepted = result.accepted;
  } catch {
    /* No secrets in public failures. */
  }
  try {
    await database.authChallenge.update({
      where: { id: challenge.id },
      data: { sendStatus: accepted ? "ACCEPTED" : "FAILED" },
    });
  } catch {
    console.error({ event: "authentication-mail-status-failed" });
  }
  return registrationAccepted;
}
export async function confirmPasswordAddition(
  database: PrismaClient,
  actor: GithubActor,
  raw: unknown,
  environment: Environment,
  requestId: string,
) {
  enabled(environment);
  const input = z
    .strictObject({
      token: z.string().regex(/^[\w-]{43}$/u),
      newPassword: passwordSchema,
    })
    .parse(raw);
  const passwordHash = await hashPassword(input.newPassword);
  return database.$transaction(async (tx) => {
    const user = await additionOwner(tx, actor);
    enabled(environment);
    const challenge = await consumeChallenge(
      tx,
      input.token,
      "ADD_PASSWORD",
      actor,
      environment,
    );
    const now = await databaseNow(tx);
    if (
      !challenge.reauthIntentId ||
      challenge.emailSnapshot !== emailSchema.parse(user.email)
    )
      throw new Error("INVALID_CHALLENGE");
    await tx.passwordCredential.create({
      data: { userId: user.id, passwordHash },
    });
    await tx.emailIdentity.update({
      where: { id: user.emailIdentity!.id },
      data: { state: "VERIFIED" },
    });
    await tx.user.update({
      where: { id: user.id },
      data: { emailVerified: now },
    });
    await tx.reauthIntent.update({
      where: { id: challenge.reauthIntentId },
      data: { consumedAt: now },
    });
    await revokeAllSessions(tx, user.id);
    await recordPasswordChange(
      tx,
      user.id,
      challenge.emailSnapshot,
      "PASSWORD_ADDED",
      requestId,
    );
    return {
      code: "PASSWORD_ADDED",
      message: "パスワードを追加しました。再ログインしてください。",
    };
  });
}
