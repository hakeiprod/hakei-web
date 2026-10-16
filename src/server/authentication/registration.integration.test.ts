import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
import { withTestConnections } from "../testing/database";
import { authenticationEnvironment } from "../testing/authentication";
import { authenticationConfig } from "./config";
import {
  requestRegistration,
  confirmRegistration,
  resendConfirmation,
} from "./registration";
import { verifyPassword } from "./password";

it("uses the owner's final password and confirms only once across DB pools", () =>
  withTestConnections(async (first, second) => {
    const config = authenticationConfig(authenticationEnvironment());
    if (!config.enabled) throw new Error("expected config");
    const email = `${randomUUID()}@example.invalid`;
    let token = "";
    const mailer = {
      sendChallenge: vi.fn(async (_email: string, value: string) => {
        token = value;
        return { accepted: true };
      }),
    };
    await requestRegistration(
      first,
      config,
      { email, password: "third-party-password" },
      randomUUID(),
      mailer,
    );
    expect(await first.user.findUnique({ where: { email } })).toBeNull();
    const results = await Promise.allSettled([
      confirmRegistration(first, {
        token,
        newPassword: "owner-selected-password",
      }),
      confirmRegistration(second, {
        token,
        newPassword: "other-final-password",
      }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const identity = await first.emailIdentity.findUniqueOrThrow({
      where: { normalizedEmail: email },
    });
    try {
      const credential = await first.passwordCredential.findUniqueOrThrow({
        where: { userId: identity.userId! },
      });
      expect(
        await verifyPassword(credential.passwordHash, "third-party-password"),
      ).toBe(false);
      const user = await first.user.findUniqueOrThrow({
        where: { id: identity.userId! },
      });
      expect(user.serviceRole).toBe("USER");
      const winner = results.findIndex(
        (result) => result.status === "fulfilled",
      );
      const passwords = ["owner-selected-password", "other-final-password"];
      expect(
        await verifyPassword(credential.passwordHash, passwords[winner]),
      ).toBe(true);
      expect(
        await verifyPassword(credential.passwordHash, passwords[1 - winner]),
      ).toBe(false);
      await expect(
        confirmRegistration(first, {
          token,
          newPassword: "owner-selected-password",
        }),
      ).rejects.toThrow("INVALID_CHALLENGE");
    } finally {
      await first.user.delete({ where: { id: identity.userId! } });
    }
  }));
it("returns the same response for SMTP failure and existing accounts without adding credentials", () =>
  withTestConnections(async (database) => {
    const config = authenticationConfig(authenticationEnvironment());
    if (!config.enabled) throw new Error("expected config");
    const email = `${randomUUID()}@example.invalid`;
    const user = await database.user.create({ data: { email } });
    const mailer = { sendChallenge: vi.fn(async () => ({ accepted: false })) };
    const unknown = `${randomUUID()}@example.invalid`;
    try {
      const existing = await requestRegistration(
        database,
        config,
        { email, password: "valid-test-password" },
        randomUUID(),
        mailer,
      );
      const failed = await requestRegistration(
        database,
        config,
        { email: unknown, password: "valid-test-password" },
        randomUUID(),
        mailer,
      );
      expect(existing).toEqual(failed);
      expect(
        await database.passwordCredential.findUnique({
          where: { userId: user.id },
        }),
      ).toBeNull();
    } finally {
      await database.user.delete({ where: { id: user.id } });
      await database.emailIdentity.deleteMany({
        where: { normalizedEmail: unknown },
      });
    }
  }));

it("reissuing a pending confirmation invalidates the old link without storing the submitted password", () =>
  withTestConnections(async (database) => {
    const config = authenticationConfig(authenticationEnvironment());
    if (!config.enabled) throw new Error("expected config");
    const email = `${randomUUID()}@example.invalid`;
    const tokens: string[] = [];
    const mailer = {
      sendChallenge: async (_email: string, token: string) => {
        tokens.push(token);
        return { accepted: true };
      },
    };
    try {
      await requestRegistration(
        database,
        config,
        { email, password: "third-party-password" },
        randomUUID(),
        mailer,
      );
      await resendConfirmation(
        database,
        config,
        { email },
        randomUUID(),
        mailer,
      );
      expect(tokens).toHaveLength(2);
      expect(await database.user.findUnique({ where: { email } })).toBeNull();
      await expect(
        confirmRegistration(database, {
          token: tokens[0],
          newPassword: "owner-selected-password",
        }),
      ).rejects.toThrow("INVALID_CHALLENGE");
      await confirmRegistration(database, {
        token: tokens[1],
        newPassword: "owner-selected-password",
      });
    } finally {
      await database.user.deleteMany({ where: { email } });
      await database.emailIdentity.deleteMany({
        where: { normalizedEmail: email },
      });
    }
  }));
