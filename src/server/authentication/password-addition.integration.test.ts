import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
import { withTestConnections } from "../testing/database";
import { authenticationEnvironment } from "../testing/authentication";
import { authenticationConfig } from "./config";
import { createSession, validateSession } from "./sessions";
import { beginGithubReauth, githubSession } from "./github-reauth";
import {
  requestPasswordAddition,
  confirmPasswordAddition,
} from "./password-addition";
import { authorizeCredentials } from "./credentials";
it("adds a password to the same user only after reauthentication and email confirmation", () =>
  withTestConnections(async (database) => {
    const environment = {
      ...authenticationEnvironment(),
      AUTH_GITHUB_ID: "test-client",
      AUTH_GITHUB_SECRET: "test-secret",
      AUTH_RATE_SECRET: randomUUID() + randomUUID(),
    };
    vi.stubEnv("AUTH_GITHUB_ID", environment.AUTH_GITHUB_ID);
    vi.stubEnv("AUTH_GITHUB_SECRET", environment.AUTH_GITHUB_SECRET);
    const config = authenticationConfig(environment);
    if (!config.enabled) throw new Error("expected config");
    const account = randomUUID(),
      email = `${randomUUID()}@example.invalid`;
    const user = await database.user.create({
      data: {
        email,
        serviceRole: "OPERATOR",
        accounts: {
          create: {
            type: "oauth",
            provider: "github",
            providerAccountId: account,
          },
        },
        emailIdentity: {
          create: { normalizedEmail: email, state: "OAUTH_BOUND" },
        },
      },
    });
    let token = "";
    const mailer = {
      sendChallenge: async (_email: string, value: string) => {
        token = value;
        return { accepted: true };
      },
    };
    try {
      const session = await createSession(database, {
        userId: user.id,
        authVersion: 0,
        method: "github",
      });
      const origin = { sub: user.id, sid: session.sid, authVersion: 0 };
      await expect(
        requestPasswordAddition(
          database,
          config,
          origin,
          environment,
          randomUUID(),
          mailer,
        ),
      ).rejects.toThrow("REAUTHENTICATION_REQUIRED");
      await beginGithubReauth(database, origin, environment);
      const reauthenticated = await githubSession(
        database,
        user.id,
        account,
        origin,
        environment,
      );
      const actor = { sub: user.id, sid: reauthenticated.sid, authVersion: 0 };
      await requestPasswordAddition(
        database,
        config,
        actor,
        environment,
        randomUUID(),
        mailer,
      );
      await expect(
        confirmPasswordAddition(
          database,
          actor,
          { token, newPassword: "owner-selected-password" },
          {},
          randomUUID(),
        ),
      ).rejects.toThrow("AUTH_METHOD_UNAVAILABLE");
      const proof = await database.reauthIntent.findFirstOrThrow({
        where: { userId: user.id, currentSid: actor.sid },
      });
      expect(proof.consumedAt).toBeNull();
      const otherSession = await createSession(database, {
        userId: user.id,
        authVersion: 0,
        method: "github",
      });
      await expect(
        confirmPasswordAddition(
          database,
          { sub: user.id, sid: otherSession.sid, authVersion: 0 },
          { token, newPassword: "owner-selected-password" },
          environment,
          randomUUID(),
        ),
      ).rejects.toThrow("INVALID_CHALLENGE");
      await database.user.update({
        where: { id: user.id },
        data: { email: `${randomUUID()}@example.invalid` },
      });
      await expect(
        confirmPasswordAddition(
          database,
          actor,
          { token, newPassword: "owner-selected-password" },
          environment,
          randomUUID(),
        ),
      ).rejects.toThrow("EMAIL_REQUIRED");
      await database.user.update({ where: { id: user.id }, data: { email } });
      const changedAccount = randomUUID();
      await database.account.update({
        where: {
          provider_providerAccountId: {
            provider: "github",
            providerAccountId: account,
          },
        },
        data: { providerAccountId: changedAccount },
      });
      await expect(
        confirmPasswordAddition(
          database,
          actor,
          { token, newPassword: "owner-selected-password" },
          environment,
          randomUUID(),
        ),
      ).rejects.toThrow("INVALID_CHALLENGE");
      await database.account.update({
        where: {
          provider_providerAccountId: {
            provider: "github",
            providerAccountId: changedAccount,
          },
        },
        data: { providerAccountId: account },
      });
      await database.reauthIntent.update({
        where: { id: proof.id },
        data: { expiresAt: new Date(0) },
      });
      await expect(
        confirmPasswordAddition(
          database,
          actor,
          { token, newPassword: "owner-selected-password" },
          environment,
          randomUUID(),
        ),
      ).rejects.toThrow("INVALID_CHALLENGE");
      await database.reauthIntent.update({
        where: { id: proof.id },
        data: { expiresAt: proof.expiresAt },
      });
      await confirmPasswordAddition(
        database,
        actor,
        { token, newPassword: "owner-selected-password" },
        environment,
        randomUUID(),
      );
      expect(await validateSession(database, actor)).toBeNull();
      const updated = await database.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(updated.serviceRole).toBe("OPERATOR");
      expect(updated.authVersion).toBe(1);
      const credentials = await authorizeCredentials(
        database,
        environment,
        { email, password: "owner-selected-password" },
        new Headers(),
      );
      expect(credentials?.id).toBe(user.id);
      await expect(
        confirmPasswordAddition(
          database,
          actor,
          { token, newPassword: "owner-selected-password" },
          environment,
          randomUUID(),
        ),
      ).rejects.toThrow();
    } finally {
      await database.user.delete({ where: { id: user.id } });
      vi.unstubAllEnvs();
    }
  }));
