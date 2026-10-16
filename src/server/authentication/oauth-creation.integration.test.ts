import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { withTestConnections } from "../testing/database";
import {
  withAuthenticationContext,
  authenticationContext,
} from "./request-context";
import { protectedOAuthAdapter } from "./adapter";
it("recovers only the same pending first account and refuses email-only account linking", () =>
  withTestConnections(async (database) => {
    const environment = {
      AUTH_GITHUB_ID: "test-client",
      AUTH_GITHUB_SECRET: "test-secret",
    };
    const adapter = protectedOAuthAdapter(database, environment);
    const account = randomUUID(),
      email = `${randomUUID()}@example.invalid`;
    const profile = {
      id: "provider-id",
      email,
      emailVerified: null,
      name: "test",
      image: null,
    };
    const run = <T>(
      operation: () => T | PromiseLike<T>,
      providerAccountId: string = account,
    ) =>
      withAuthenticationContext(async () => {
        authenticationContext()!.github = { providerAccountId };
        return operation();
      });
    try {
      const original = await run(() => adapter.createUser!(profile));
      const recovered = await run(() => adapter.createUser!(profile));
      expect(recovered.id).toBe(original.id);
      await expect(
        run(() => adapter.createUser!(profile), "different-account"),
      ).rejects.toThrow();
      await run(async () => {
        await adapter.linkAccount!({
          type: "oauth",
          provider: "github",
          providerAccountId: account,
          userId: original.id,
        });
      });
      expect(
        await database.account.count({ where: { userId: original.id } }),
      ).toBe(1);
      await expect(run(() => adapter.createUser!(profile))).rejects.toThrow();
      await expect(
        run(async () => {
          await adapter.linkAccount!({
            type: "oauth",
            provider: "github",
            providerAccountId: "another-account",
            userId: original.id,
          });
        }, "another-account"),
      ).rejects.toThrow();
    } finally {
      await database.user.deleteMany({ where: { email } });
    }
  }));
