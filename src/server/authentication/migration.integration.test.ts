import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { withTestConnections } from "../testing/database";
import { backfillEmailIdentities } from "./backfill";

it("keeps existing identities and roles, blocks normalized collisions and is idempotent", () =>
  withTestConnections(async (database) => {
    const key = randomUUID();
    const users = await Promise.all([
      database.user.create({
        data: { email: `${key}@Example.invalid`, serviceRole: "OPERATOR" },
      }),
      database.user.create({ data: { email: `${key}@example.invalid` } }),
      database.user.create({
        data: {
          email: `${key}+practice@Example.invalid`,
          serviceRole: "ADMIN",
        },
      }),
    ]);
    try {
      const result = await backfillEmailIdentities(database);
      expect(result.blockedUserIds).toContain(users[0].id);
      expect(result.blockedUserIds).toContain(users[1].id);
      expect(
        await database.emailIdentity.findUnique({
          where: { userId: users[0].id },
        }),
      ).toBeNull();
      const identity = await database.emailIdentity.findUniqueOrThrow({
        where: { userId: users[2].id },
      });
      expect(identity.normalizedEmail).toBe(`${key}+practice@example.invalid`);
      expect(identity.state).toBe("OAUTH_BOUND");
      expect(
        await database.passwordCredential.findUnique({
          where: { userId: users[2].id },
        }),
      ).toBeNull();
      await backfillEmailIdentities(database);
      const repeated = await database.emailIdentity.findUniqueOrThrow({
        where: { userId: users[2].id },
      });
      expect(repeated.id).toBe(identity.id);
      for (const user of users)
        expect(
          await database.user.findUniqueOrThrow({ where: { id: user.id } }),
        ).toEqual(user);
    } finally {
      await database.user.deleteMany({
        where: { id: { in: users.map((user) => user.id) } },
      });
    }
  }));
