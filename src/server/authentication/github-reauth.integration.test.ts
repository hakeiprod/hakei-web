import { randomUUID } from "node:crypto";
import * as clock from "./rate-limit";
import { expect, it, vi } from "vitest";
import { withTestConnections } from "../testing/database";
import { createSession, validateSession } from "./sessions";
import { beginGithubReauth, githubSession } from "./github-reauth";
const environment = {
  AUTH_GITHUB_ID: "test-client",
  AUTH_GITHUB_SECRET: "test-secret",
};
it("binds reauthentication to the same account and migrates proof once to a new sid", () =>
  withTestConnections(async (database, other) => {
    const user = await database.user.create({
      data: {
        email: `${randomUUID()}@example.invalid`,
        accounts: {
          create: {
            type: "oauth",
            provider: "github",
            providerAccountId: randomUUID(),
          },
        },
      },
      include: { accounts: true },
    });
    const providerAccountId = user.accounts[0].providerAccountId;
    try {
      const original = await createSession(database, {
        userId: user.id,
        authVersion: 0,
        method: "github",
      });
      const actor = { sub: user.id, sid: original.sid, authVersion: 0 };
      await expect(beginGithubReauth(database, actor, {})).rejects.toThrow(
        "AUTH_METHOD_UNAVAILABLE",
      );
      await beginGithubReauth(database, actor, environment);
      await expect(
        githubSession(database, user.id, "other-account", actor, environment),
      ).rejects.toThrow("UNAUTHENTICATED");
      const result = await Promise.allSettled(
        [database, other].map((connection) =>
          githubSession(
            connection,
            user.id,
            providerAccountId,
            actor,
            environment,
          ),
        ),
      );
      expect(result.filter((item) => item.status === "fulfilled")).toHaveLength(
        1,
      );
      expect(await validateSession(database, actor)).toBeNull();
      const proof = await database.reauthIntent.findFirstOrThrow({
        where: { userId: user.id },
      });
      expect(proof.completedAt).not.toBeNull();
      expect(proof.currentSid).not.toBe(original.sid);
      expect(proof.expiresAt.getTime() - proof.completedAt!.getTime()).toBe(
        15 * 60_000,
      );
      await expect(
        githubSession(database, user.id, providerAccountId, actor, environment),
      ).rejects.toThrow("UNAUTHENTICATED");
    } finally {
      vi.restoreAllMocks();
      await database.user.delete({ where: { id: user.id } });
    }
  }));
it("rejects a callback after the requested reauthentication deadline", () =>
  withTestConnections(async (database) => {
    const account = randomUUID();
    const user = await database.user.create({
      data: {
        accounts: {
          create: {
            type: "oauth",
            provider: "github",
            providerAccountId: account,
          },
        },
      },
    });
    try {
      const session = await createSession(database, {
        userId: user.id,
        authVersion: 0,
        method: "github",
      });
      const actor = { sub: user.id, sid: session.sid, authVersion: 0 };
      await beginGithubReauth(database, actor, environment);
      const proof = await database.reauthIntent.findFirstOrThrow({
        where: { userId: user.id },
      });
      vi.spyOn(clock, "databaseNow").mockResolvedValue(proof.expiresAt);
      await expect(
        githubSession(database, user.id, account, actor, environment),
      ).rejects.toThrow("REAUTHENTICATION_REQUIRED");
    } finally {
      vi.restoreAllMocks();
      await database.user.delete({ where: { id: user.id } });
    }
  }));
