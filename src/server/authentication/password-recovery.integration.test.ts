import { randomUUID } from "node:crypto";
import { Auth } from "@auth/core";
import { encode } from "next-auth/jwt";
import { authenticationOptions } from "./authjs";
import { expect, it } from "vitest";
import { withTestConnections } from "../testing/database";
import { authenticationEnvironment } from "../testing/authentication";
import { authenticationConfig } from "./config";
import { requestRegistration, confirmRegistration } from "./registration";
import { requestPasswordReset, resetPassword } from "./password-recovery";
import { changePassword } from "./password-change";
import { createSession, validateSession } from "./sessions";
import { verifyPassword } from "./password";

it("resets once across pools, invalidates both methods and preserves the existing user", () =>
  withTestConnections(async (database, other) => {
    const config = authenticationConfig(authenticationEnvironment());
    if (!config.enabled) throw new Error("expected config");
    const email = `${randomUUID()}@example.invalid`;
    let token = "";
    const mailer = {
      sendChallenge: async (_email: string, value: string) => {
        token = value;
        return { accepted: true };
      },
    };
    try {
      await requestRegistration(
        database,
        config,
        { email, password: "original-password" },
        randomUUID(),
        mailer,
      );
      await confirmRegistration(database, {
        token,
        newPassword: "original-password",
      });
      const user = await database.user.findUniqueOrThrow({ where: { email } });
      const credentials = await createSession(database, {
        userId: user.id,
        authVersion: 0,
        method: "credentials",
        credentialVersion: 1,
      });
      const github = await createSession(database, {
        userId: user.id,
        authVersion: 0,
        method: "github",
      });
      await requestPasswordReset(
        database,
        config,
        { email },
        randomUUID(),
        mailer,
      );
      const oldToken = token;
      await database.authChallenge.updateMany({
        where: { userId: user.id },
        data: { expiresAt: new Date(0) },
      });
      await expect(
        resetPassword(
          database,
          { token: oldToken, newPassword: "replacement-password" },
          randomUUID(),
        ),
      ).rejects.toThrow("INVALID_CHALLENGE");
      await requestPasswordReset(
        database,
        config,
        { email },
        randomUUID(),
        mailer,
      );
      await expect(
        resetPassword(
          database,
          { token: oldToken, newPassword: "replacement-password" },
          randomUUID(),
        ),
      ).rejects.toThrow("INVALID_CHALLENGE");
      const results = await Promise.allSettled(
        [database, other].map((connection) =>
          resetPassword(
            connection,
            { token, newPassword: "replacement-password" },
            randomUUID(),
          ),
        ),
      );
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      for (const session of [credentials, github])
        expect(
          await validateSession(database, {
            sub: user.id,
            sid: session.sid,
            authVersion: 0,
          }),
        ).toBeNull();
      const secret = "test-only-password-recovery-sdk-secret";
      for (const session of [credentials, github]) {
        const jwt = await encode({
          secret,
          salt: "authjs.session-token",
          token: { sub: user.id, sid: session.sid, authVersion: 0 },
        });
        const response = await Auth(
          new Request("http://localhost:3000/api/auth/session", {
            headers: { cookie: `authjs.session-token=${jwt}` },
          }),
          {
            ...authenticationOptions(database, authenticationEnvironment()),
            secret,
            trustHost: true,
            basePath: "/api/auth",
          },
        );
        expect(await response.json()).toBeNull();
      }
      const credential = await database.passwordCredential.findUniqueOrThrow({
        where: { userId: user.id },
      });
      expect(
        await verifyPassword(credential.passwordHash, "original-password"),
      ).toBe(false);
      expect(
        await verifyPassword(credential.passwordHash, "replacement-password"),
      ).toBe(true);
      const unchanged = await database.user.findUniqueOrThrow({
        where: { email },
      });
      expect(unchanged.id).toBe(user.id);
      expect(unchanged.serviceRole).toBe(user.serviceRole);
      expect(unchanged.authVersion).toBe(1);
      const session = await createSession(database, {
        userId: user.id,
        authVersion: 1,
        method: "credentials",
        credentialVersion: 2,
      });
      const actor = { sub: user.id, sid: session.sid, authVersion: 1 };
      await expect(
        changePassword(
          database,
          actor,
          {
            currentPassword: "incorrect-password",
            newPassword: "another-new-password",
          },
          randomUUID(),
          config,
          randomUUID(),
        ),
      ).rejects.toThrow("INVALID_CREDENTIALS");
      await changePassword(
        database,
        actor,
        {
          currentPassword: "replacement-password",
          newPassword: "another-new-password",
        },
        randomUUID(),
        config,
        randomUUID(),
      );
      expect(await validateSession(database, actor)).toBeNull();
      const changedCredential =
        await database.passwordCredential.findUniqueOrThrow({
          where: { userId: user.id },
        });
      expect(
        await verifyPassword(
          changedCredential.passwordHash,
          "replacement-password",
        ),
      ).toBe(false);
      expect(
        await verifyPassword(
          changedCredential.passwordHash,
          "another-new-password",
        ),
      ).toBe(true);
      expect(
        await database.authChangeEvent.count({ where: { userId: user.id } }),
      ).toBe(2);
    } finally {
      await database.user.deleteMany({ where: { email } });
      await database.emailIdentity.deleteMany({
        where: { normalizedEmail: email },
      });
    }
  }));
it("does not add credentials through reset to pending or OAuth-only identities", () =>
  withTestConnections(async (database) => {
    const config = authenticationConfig(authenticationEnvironment());
    if (!config.enabled) throw new Error("expected config");
    const email = `${randomUUID()}@example.invalid`;
    const user = await database.user.create({ data: { email } });
    await database.emailIdentity.create({
      data: { normalizedEmail: email, userId: user.id, state: "OAUTH_BOUND" },
    });
    const pendingEmail = `${randomUUID()}@example.invalid`;
    const pending = await database.emailIdentity.create({
      data: { normalizedEmail: pendingEmail, state: "PENDING" },
    });
    let sent = false;
    const mailer = {
      sendChallenge: async () => {
        sent = true;
        return { accepted: true };
      },
    };
    try {
      const existing = await requestPasswordReset(
        database,
        config,
        { email },
        randomUUID(),
        mailer,
      );
      const unknown = await requestPasswordReset(
        database,
        config,
        { email: `${randomUUID()}@example.invalid` },
        randomUUID(),
        mailer,
      );
      const unverified = await requestPasswordReset(
        database,
        config,
        { email: pendingEmail },
        randomUUID(),
        mailer,
      );
      expect(unverified).toEqual(unknown);
      expect(existing).toEqual(unknown);
      expect(sent).toBe(false);
      expect(
        await database.passwordCredential.findUnique({
          where: { userId: user.id },
        }),
      ).toBeNull();
    } finally {
      await database.user.delete({ where: { id: user.id } });
      await database.emailIdentity.delete({ where: { id: pending.id } });
    }
  }));
it("does not promote a current-password proof when reset competes with change", () =>
  withTestConnections(async (database, other) => {
    const config = authenticationConfig(authenticationEnvironment());
    if (!config.enabled) throw new Error("expected config");
    const { hashPassword } = await import("./password");
    const passwordHash = await hashPassword("original-password");
    const email = `${randomUUID()}@example.invalid`;
    const user = await database.user.create({
      data: {
        email,
        passwordCredential: { create: { passwordHash } },
        emailIdentity: {
          create: { normalizedEmail: email, state: "VERIFIED" },
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
        method: "credentials",
        authVersion: 0,
        credentialVersion: 1,
      });
      await requestPasswordReset(
        database,
        config,
        { email },
        randomUUID(),
        mailer,
      );
      const results = await Promise.allSettled([
        changePassword(
          database,
          { sub: user.id, sid: session.sid, authVersion: 0 },
          {
            currentPassword: "original-password",
            newPassword: "changed-password",
          },
          randomUUID(),
          config,
          randomUUID(),
        ),
        resetPassword(
          other,
          { token, newPassword: "reset-new-password" },
          randomUUID(),
        ),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      const current = await database.user.findUniqueOrThrow({
        where: { id: user.id },
        include: { passwordCredential: true },
      });
      expect(current.authVersion).toBe(1);
      expect(current.passwordCredential?.version).toBe(2);
      expect(
        await database.authChangeEvent.count({ where: { userId: user.id } }),
      ).toBe(1);
      expect(
        await validateSession(database, {
          sub: user.id,
          sid: session.sid,
          authVersion: 0,
        }),
      ).toBeNull();
      expect(
        await verifyPassword(
          current.passwordCredential!.passwordHash,
          "original-password",
        ),
      ).toBe(false);
    } finally {
      await database.user.delete({ where: { id: user.id } });
    }
  }));
