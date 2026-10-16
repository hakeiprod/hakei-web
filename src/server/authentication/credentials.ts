import "server-only";
import type { PrismaClient } from "../../generated/prisma/client";
import { authenticationConfig } from "./config";
import { credentialsSchema, emailSchema } from "./input";
import { reserveLogin, finishLogin, requestSource } from "./rate-limit";
import { verifyPassword } from "./password";

export async function authorizeCredentials(
  database: PrismaClient,
  environment: Readonly<Record<string, string | undefined>>,
  raw: unknown,
  headers: Headers,
) {
  try {
    const config = authenticationConfig(environment);
    if (!config.enabled) return null;
    const input = credentialsSchema.safeParse(raw);
    if (!input.success) return null;
    const attempt = await reserveLogin(database, {
      mailbox: input.data.email,
      source: requestSource(headers, config.trustedProxy),
      secret: config.rateSecret,
      mailboxLimit: config.limits.loginMailbox,
      sourceLimit: config.limits.loginSource,
    });
    try {
      const identity = await database.emailIdentity.findUnique({
        where: { normalizedEmail: input.data.email },
        include: { user: { include: { passwordCredential: true } } },
      });
      const user = identity?.state === "VERIFIED" ? identity.user : null;
      const credential = user?.passwordCredential;
      const currentEmail = emailSchema.safeParse(user?.email);
      const eligible = Boolean(
        credential &&
        currentEmail.success &&
        currentEmail.data === input.data.email,
      );
      const valid = await verifyPassword(
        eligible ? credential?.passwordHash : undefined,
        input.data.password,
      );
      const accepted = await finishLogin(
        database,
        attempt.id,
        valid && eligible,
      );
      if (!accepted || !user || !credential) return null;
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        authVersion: user.authVersion,
        credentialVersion: credential.version,
      };
    } catch {
      await finishLogin(database, attempt.id, false);
      return null;
    }
  } catch {
    return null;
  }
}
