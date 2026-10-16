import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
import * as clock from "./rate-limit";
import { withTestConnections } from "../testing/database";
import { issueChallenge, consumeChallenge } from "./challenges";

it("rejects wrong purposes, replaced generations and expired tokens; simultaneous consumption succeeds once", () =>
  withTestConnections(async (first, second) => {
    const identity = await first.emailIdentity.create({
      data: {
        normalizedEmail: `${randomUUID()}@example.invalid`,
        state: "PENDING",
      },
    });
    try {
      const input = {
        identityId: identity.id,
        purpose: "VERIFY" as const,
        emailSnapshot: identity.normalizedEmail,
      };
      const original = await issueChallenge(first, input);
      const current = await issueChallenge(second, input);
      await expect(
        first.$transaction((tx) =>
          consumeChallenge(tx, original.token, "VERIFY"),
        ),
      ).rejects.toThrow();
      await expect(
        first.$transaction((tx) =>
          consumeChallenge(tx, current.token, "RESET"),
        ),
      ).rejects.toThrow();
      await expect(
        first.$transaction((tx) =>
          consumeChallenge(tx, current.token + "changed", "VERIFY"),
        ),
      ).rejects.toThrow();
      const results = await Promise.allSettled([
        first.$transaction((tx) =>
          consumeChallenge(tx, current.token, "VERIFY"),
        ),
        second.$transaction((tx) =>
          consumeChallenge(tx, current.token, "VERIFY"),
        ),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === "rejected"),
      ).toHaveLength(1);
      const expired = await issueChallenge(first, input);
      await first.authChallenge.update({
        where: { id: expired.id },
        data: { expiresAt: new Date(0) },
      });
      await expect(
        first.$transaction((tx) =>
          consumeChallenge(tx, expired.token, "VERIFY"),
        ),
      ).rejects.toThrow();
      const persisted = await first.authChallenge.findUniqueOrThrow({
        where: { id: expired.id },
      });
      expect(persisted.tokenDigest).not.toBe(expired.token);
      expect(JSON.stringify(persisted)).not.toContain(expired.token);
      expect(persisted.consumedAt).toBeNull();
    } finally {
      await first.emailIdentity.delete({ where: { id: identity.id } });
    }
  }));

it("rejects a challenge at the exact expiration time and rolls back consumption", () =>
  withTestConnections(async (database) => {
    const identity = await database.emailIdentity.create({
      data: {
        normalizedEmail: `${randomUUID()}@example.invalid`,
        state: "PENDING",
      },
    });
    try {
      const challenge = await issueChallenge(database, {
        identityId: identity.id,
        purpose: "VERIFY",
        emailSnapshot: identity.normalizedEmail,
      });
      const time = vi
        .spyOn(clock, "databaseNow")
        .mockResolvedValue(challenge.expiresAt);
      try {
        await expect(
          database.$transaction((tx) =>
            consumeChallenge(tx, challenge.token, "VERIFY"),
          ),
        ).rejects.toThrow("INVALID_CHALLENGE");
      } finally {
        time.mockRestore();
      }
      const record = await database.authChallenge.findUniqueOrThrow({
        where: { id: challenge.id },
      });
      expect(record.consumedAt).toBeNull();
    } finally {
      await database.emailIdentity.delete({ where: { id: identity.id } });
    }
  }));
