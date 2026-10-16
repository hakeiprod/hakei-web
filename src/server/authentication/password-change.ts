import "server-only";
import { z } from "zod";
import type { PrismaClient } from "../../generated/prisma/client";
import type { authenticationConfig } from "./config";
import { emailSchema, passwordSchema } from "./input";
import { hashPassword, verifyPassword } from "./password";
import {
  lockSession,
  revokeAllSessions,
  validateSessionStrict,
} from "./sessions";
import { recordPasswordChange } from "./notices";
import { reserveLogin, finishLogin } from "./rate-limit";
type Actor = { sub: string; sid: string; authVersion: number };
type Configuration = Extract<
  ReturnType<typeof authenticationConfig>,
  { enabled: true }
>;
export async function changePassword(
  database: PrismaClient,
  actor: Actor,
  raw: unknown,
  requestId: string,
  config: Configuration,
  source: string,
) {
  const input = z
    .strictObject({
      currentPassword: passwordSchema,
      newPassword: passwordSchema,
    })
    .parse(raw);
  if (!(await validateSessionStrict(database, actor)))
    throw new Error("UNAUTHENTICATED");
  const user = await database.user.findUniqueOrThrow({
    where: { id: actor.sub },
    include: { passwordCredential: true, emailIdentity: true },
  });
  const email = emailSchema.parse(user.email);
  const attempt = await reserveLogin(database, {
    mailbox: email,
    source,
    secret: config.rateSecret,
    mailboxLimit: config.limits.loginMailbox,
    sourceLimit: config.limits.loginSource,
  });
  let accepted = false;
  try {
    accepted = await verifyPassword(
      user.passwordCredential?.passwordHash,
      input.currentPassword,
    );
  } catch {
    /* Finalize reservation on failure. */
  }
  if (
    !(await finishLogin(database, attempt.id, accepted)) ||
    !user.passwordCredential ||
    user.emailIdentity?.state !== "VERIFIED"
  )
    throw new Error("INVALID_CREDENTIALS");
  const passwordHash = await hashPassword(input.newPassword);
  return database.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${actor.sub} FOR UPDATE`;
    await lockSession(tx, actor);
    const current = await tx.user.findUniqueOrThrow({
      where: { id: actor.sub },
      include: { passwordCredential: true, emailIdentity: true },
    });
    if (
      current.authVersion !== user.authVersion ||
      current.passwordCredential?.version !==
        user.passwordCredential!.version ||
      current.email !== user.email ||
      current.emailIdentity?.state !== "VERIFIED"
    )
      throw new Error("UNAUTHENTICATED");
    await tx.passwordCredential.update({
      where: { userId: actor.sub },
      data: { passwordHash, version: { increment: 1 } },
    });
    await revokeAllSessions(tx, actor.sub);
    await recordPasswordChange(
      tx,
      actor.sub,
      email,
      "PASSWORD_CHANGED",
      requestId,
    );
    return {
      code: "PASSWORD_CHANGED",
      message: "パスワードを変更しました。再ログインしてください。",
    };
  });
}
