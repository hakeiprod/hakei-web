import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
import { withTestConnections } from "../testing/database";
import { authenticationEnvironment } from "../testing/authentication";
import { authenticationConfig } from "./config";
import { requestRegistration } from "./registration";
import { requestPasswordReset } from "./password-recovery";
import { hashPassword } from "./password";
it("keeps public requests and persisted data secret-free across target states and SMTP failures", () =>
  withTestConnections(async (database) => {
    const password = "test-disclosure-password";
    const passwordHash = await hashPassword(password);
    const responses: unknown[] = [],
      tokens: string[] = [],
      emails: string[] = [];
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      for (const state of ["UNKNOWN", "PENDING", "VERIFIED", "OAUTH_BOUND"]) {
        const email = `${randomUUID()}@example.invalid`;
        emails.push(email);
        if (state === "PENDING")
          await database.emailIdentity.create({
            data: { normalizedEmail: email, state },
          });
        if (state === "VERIFIED" || state === "OAUTH_BOUND")
          await database.user.create({
            data: {
              email,
              emailIdentity: { create: { normalizedEmail: email, state } },
              ...(state === "VERIFIED"
                ? { passwordCredential: { create: { passwordHash } } }
                : {}),
            },
          });
        const config = authenticationConfig({
          ...authenticationEnvironment(),
          AUTH_SEND_MAILBOX_LIMIT: "2",
          AUTH_RATE_SECRET: randomUUID() + randomUUID(),
        });
        if (!config.enabled) throw new Error("expected config");
        const mailer = {
          sendChallenge: async (_email: string, token: string) => {
            tokens.push(token);
            throw new Error(`simulated SMTP timeout ${password} ${token}`);
          },
        };
        const registration = await requestRegistration(
          database,
          config,
          { email, password },
          randomUUID(),
          mailer,
        );
        const reset = await requestPasswordReset(
          database,
          config,
          { email },
          randomUUID(),
          mailer,
        );
        responses.push(registration, reset);
        await expect(
          requestPasswordReset(
            database,
            config,
            { email },
            randomUUID(),
            mailer,
          ),
        ).rejects.toThrow("RETRY_LATER");
      }
      for (const response of responses) expect(response).toEqual(responses[0]);
      const users = await database.user.findMany({
        where: { email: { in: emails } },
        include: { passwordCredential: true },
      });
      const identities = await database.emailIdentity.findMany({
        where: { normalizedEmail: { in: emails } },
        include: { heads: { include: { challenges: true } } },
      });
      const persisted = JSON.stringify({ users, identities });
      const exposed = JSON.stringify({ responses, logs: errorLog.mock.calls });
      for (const secret of [password, ...tokens]) {
        expect(persisted).not.toContain(secret);
        expect(exposed).not.toContain(secret);
      }
    } finally {
      errorLog.mockRestore();
      await database.user.deleteMany({ where: { email: { in: emails } } });
      await database.emailIdentity.deleteMany({
        where: { normalizedEmail: { in: emails } },
      });
    }
  }));
