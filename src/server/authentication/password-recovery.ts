import "server-only";
import { z } from "zod";
import type { PrismaClient } from "../../generated/prisma/client";
import type { authenticationConfig } from "./config";
import { emailSchema, passwordSchema } from "./input";
import { reserveSend } from "./rate-limit";
import { authenticationMailer } from "./mail";
import { issueChallengeInTransaction, consumeChallenge } from "./challenges";
import { registrationAccepted } from "./registration";
import { hashPassword } from "./password";
import { revokeAllSessions } from "./sessions";
import { recordPasswordChange } from "./notices";

type Configuration = Extract<
  ReturnType<typeof authenticationConfig>,
  { enabled: true }
>;
export async function requestPasswordReset(
  database: PrismaClient,
  config: Configuration,
  raw: unknown,
  source: string,
  mailer: Pick<
    ReturnType<typeof authenticationMailer>,
    "sendChallenge"
  > = authenticationMailer(config),
) {
  const { email } = z.strictObject({ email: emailSchema }).parse(raw);
  await reserveSend(database, {
    mailbox: email,
    source,
    secret: config.rateSecret,
    mailboxLimit: config.limits.sendMailbox,
    sourceLimit: config.limits.sendSource,
  });
  const challenge = await database.$transaction(async (tx) => {
    const snapshot = await tx.emailIdentity.findUnique({
      where: { normalizedEmail: email },
    });
    if (!snapshot?.userId || snapshot.state !== "VERIFIED") return null;
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${snapshot.userId} FOR SHARE`;
    const identity = await tx.emailIdentity.findUnique({
      where: { id: snapshot.id },
      include: { user: { include: { passwordCredential: true } } },
    });
    const user = identity?.user;
    if (
      identity?.state !== "VERIFIED" ||
      !user?.passwordCredential ||
      emailSchema.safeParse(user.email).data !== email
    )
      return null;
    return issueChallengeInTransaction(tx, {
      identityId: identity.id,
      purpose: "RESET",
      emailSnapshot: email,
      userId: user.id,
      authVersion: user.authVersion,
    });
  });
  if (challenge) {
    let accepted = false;
    try {
      const result = await mailer.sendChallenge(
        email,
        challenge.token,
        "RESET",
      );
      accepted = result.accepted;
    } catch {
      /* Same public response. */
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
export async function resetPassword(
  database: PrismaClient,
  raw: unknown,
  requestId: string,
) {
  const input = z
    .strictObject({
      token: z.string().regex(/^[\w-]{43}$/u),
      newPassword: passwordSchema,
    })
    .parse(raw);
  const passwordHash = await hashPassword(input.newPassword);
  return database.$transaction(async (tx) => {
    const challenge = await consumeChallenge(tx, input.token, "RESET");
    if (!challenge.userId || challenge.head.identity.state !== "VERIFIED")
      throw new Error("INVALID_CHALLENGE");
    const credential = await tx.passwordCredential.findUnique({
      where: { userId: challenge.userId },
    });
    if (!credential) throw new Error("INVALID_CHALLENGE");
    await tx.passwordCredential.update({
      where: { userId: challenge.userId },
      data: { passwordHash, version: { increment: 1 } },
    });
    await revokeAllSessions(tx, challenge.userId);
    await recordPasswordChange(
      tx,
      challenge.userId,
      challenge.emailSnapshot,
      "PASSWORD_RESET",
      requestId,
    );
    return {
      code: "PASSWORD_RESET",
      message: "パスワードを再設定しました。再ログインしてください。",
    };
  });
}
