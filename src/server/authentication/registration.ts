import "server-only";
import { z } from "zod";
import type { PrismaClient, Prisma } from "../../generated/prisma/client";
import type { authenticationConfig } from "./config";
import { emailSchema, passwordSchema, credentialsSchema } from "./input";
import { databaseNow, reserveSend } from "./rate-limit";
import { authenticationMailer } from "./mail";
import { issueChallengeInTransaction, consumeChallenge } from "./challenges";
import { hashPassword } from "./password";

type Configuration = Extract<
  ReturnType<typeof authenticationConfig>,
  { enabled: true }
>;
type Mailer = Pick<ReturnType<typeof authenticationMailer>, "sendChallenge">;
export const registrationAccepted = {
  code: "ACCEPTED",
  message:
    "手続きが可能な場合は確認メールを送信しました。受信メールを確認してください。",
} as const;
async function legacyEmailExists(
  transaction: Prisma.TransactionClient,
  email: string,
) {
  const users = await transaction.user.findMany({
    where: { email: { not: null } },
    select: { email: true },
  });
  return users.some((user) => {
    const parsed = emailSchema.safeParse(user.email);
    return parsed.success && parsed.data === email;
  });
}
async function requestConfirmation(
  database: PrismaClient,
  config: Configuration,
  email: string,
  source: string,
  mailer: Mailer,
) {
  await reserveSend(database, {
    mailbox: email,
    source,
    secret: config.rateSecret,
    mailboxLimit: config.limits.sendMailbox,
    sourceLimit: config.limits.sendSource,
  });
  const challenge = await database.$transaction(async (tx) => {
    if (await legacyEmailExists(tx, email)) return null;
    const identity = await tx.emailIdentity.upsert({
      where: { normalizedEmail: email },
      create: { normalizedEmail: email, state: "PENDING" },
      update: {},
    });
    if (identity.userId || identity.state !== "PENDING") return null;
    return issueChallengeInTransaction(tx, {
      identityId: identity.id,
      purpose: "VERIFY",
      emailSnapshot: email,
    });
  });
  if (challenge) {
    let accepted = false;
    try {
      const result = await mailer.sendChallenge(
        email,
        challenge.token,
        "VERIFY",
      );
      accepted = result.accepted;
    } catch {
      /* Public response remains identical. */
    }
    try {
      await database.authChallenge.update({
        where: { id: challenge.id },
        data: { sendStatus: accepted ? "ACCEPTED" : "FAILED" },
      });
    } catch {
      console.error({ event: "authentication-mail-status-failed" });
    }
  }
  return registrationAccepted;
}
export function requestRegistration(
  database: PrismaClient,
  config: Configuration,
  raw: unknown,
  source: string,
  mailer: Mailer = authenticationMailer(config),
) {
  const input = credentialsSchema.parse(raw);
  return requestConfirmation(database, config, input.email, source, mailer);
}
export function resendConfirmation(
  database: PrismaClient,
  config: Configuration,
  raw: unknown,
  source: string,
  mailer: Mailer = authenticationMailer(config),
) {
  const input = z.strictObject({ email: emailSchema }).parse(raw);
  return requestConfirmation(database, config, input.email, source, mailer);
}
export async function confirmRegistration(
  database: PrismaClient,
  raw: unknown,
) {
  const input = z
    .strictObject({
      token: z.string().regex(/^[\w-]{43}$/u),
      newPassword: passwordSchema,
    })
    .parse(raw);
  const passwordHash = await hashPassword(input.newPassword);
  return database.$transaction(async (tx) => {
    // Existing users without an identity index must not be duplicated during rollout.
    await tx.$executeRaw`LOCK TABLE "users" IN SHARE ROW EXCLUSIVE MODE`;
    const challenge = await consumeChallenge(tx, input.token, "VERIFY");
    if (await legacyEmailExists(tx, challenge.emailSnapshot))
      throw new Error("INVALID_CHALLENGE");
    const user = await tx.user.create({
      data: {
        email: challenge.emailSnapshot,
        emailVerified: await databaseNow(tx),
        serviceRole: "USER",
        passwordCredential: { create: { passwordHash } },
      },
    });
    await tx.emailIdentity.update({
      where: { id: challenge.head.identityId },
      data: { userId: user.id, state: "VERIFIED" },
    });
    return {
      code: "REGISTERED",
      message:
        "登録が完了しました。メールアドレスとパスワードでログインしてください。",
    } as const;
  });
}
