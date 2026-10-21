import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { withTestConnections } from "./testing/database";
import { adjustTrust, publishTrustRule, readTrust, reviewUser } from "./trust";
const rule = {
  initialScore: 10,
  wAdmin: 2,
  wOutcome: 3,
  wReview: 4,
  acceptedDelta: 5,
  rejectedDelta: -2,
  reviewFactor: 0.5,
  minReview: -1,
  maxReview: 1,
  minScore: 0,
  maxScore: 100,
  mergeThreshold: 50,
};
test("trust is unconfigured by default; rules, reviews and adjustments are audited and idempotent", async () => {
  await withTestConnections(async (database) => {
    const operator = await database.user.create({
      data: { serviceRole: "OPERATOR" },
    });
    const user = await database.user.create({ data: {} });
    const reviewer = await database.user.create({ data: {} });
    const ids = [operator.id, user.id, reviewer.id];
    try {
      await expect(readTrust(database, user.id)).rejects.toThrow(
        "TRUST_UNCONFIGURED",
      );
      await expect(
        publishTrustRule(database, {
          actorId: user.id,
          rule,
          reason: "unauthorized",
          expectedPolicyVersion: 0,
          key: "unauthorized",
        }),
      ).rejects.toThrow("FORBIDDEN");
      await publishTrustRule(database, {
        actorId: operator.id,
        rule,
        reason: "Test policy",
        expectedPolicyVersion: 0,
        key: "rule",
      });
      const initial = await database.$transaction((transaction) =>
        readTrust(transaction, user.id),
      );
      expect(initial.score).toBe(10);
      await expect(
        reviewUser(database, { actorId: user.id, targetId: user.id, value: 1 }),
      ).rejects.toThrow("SELF_REVIEW_FORBIDDEN");
      await reviewUser(database, {
        actorId: reviewer.id,
        targetId: user.id,
        value: 1,
      });
      await reviewUser(database, {
        actorId: reviewer.id,
        targetId: user.id,
        value: 1,
      });
      expect(
        await database.userTrustReview.count({ where: { targetId: user.id } }),
      ).toBe(1);
      expect(
        await database.userTrustState.findUnique({
          where: { userId: user.id },
        }),
      ).toMatchObject({ inputVersion: 1 });
      const reviewed = await database.$transaction((transaction) =>
        readTrust(transaction, user.id),
      );
      expect(reviewed.score).toBe(12);
      await reviewUser(database, {
        actorId: reviewer.id,
        targetId: user.id,
        value: -1,
        expectedVersion: 0,
      });
      const updated = await database.$transaction((transaction) =>
        readTrust(transaction, user.id),
      );
      expect(updated.score).toBe(8);
      await database.trustEvent.create({
        data: {
          userId: user.id,
          type: "ACCEPTED",
          sourceId: randomUUID(),
          actorId: user.id,
          value: 1,
          reason: "Self merge excluded",
        },
      });
      const selfMerge = await database.$transaction((transaction) =>
        readTrust(transaction, user.id),
      );
      expect(selfMerge.inputs.accepted).toBe(0);
      const adjustment = {
        actorId: operator.id,
        targetId: user.id,
        desiredScore: 100,
        expectedRuleId: initial.ruleId,
        reason: "Reach ceiling",
        key: "ceiling",
      };
      await adjustTrust(database, adjustment);
      await adjustTrust(database, adjustment);
      expect(
        await database.trustEvent.count({
          where: { userId: user.id, type: "ADJUSTMENT" },
        }),
      ).toBe(1);
      await adjustTrust(database, {
        ...adjustment,
        desiredScore: 50,
        reason: "Exact target",
        key: "target",
      });
      const finalTrust = await database.$transaction((transaction) =>
        readTrust(transaction, user.id),
      );
      expect(finalTrust.score).toBe(50);
      await expect(
        adjustTrust(database, {
          ...adjustment,
          actorId: user.id,
          key: "self-promote",
        }),
      ).rejects.toThrow("FORBIDDEN");
      await publishTrustRule(database, {
        actorId: operator.id,
        rule: { ...rule, initialScore: 20 },
        reason: "New policy",
        expectedPolicyVersion: 1,
        key: "rule-new",
      });
      const changed = await database.$transaction((transaction) =>
        readTrust(transaction, user.id),
      );
      expect(changed.ruleId).not.toBe(initial.ruleId);
      expect(changed.score).toBe(60);
      await expect(
        adjustTrust(database, { ...adjustment, key: "old-policy" }),
      ).rejects.toThrow("CONFLICT");
    } finally {
      await database.auditEvent.deleteMany({ where: { actorId: { in: ids } } });
      await database.mutationReceipt.deleteMany({
        where: { actorId: { in: ids } },
      });
      await database.trustSnapshot.deleteMany({
        where: { userId: { in: ids } },
      });
      await database.userTrustState.deleteMany({
        where: { userId: { in: ids } },
      });
      await database.userTrustReview.deleteMany({
        where: { targetId: { in: ids } },
      });
      await database.trustEvent.deleteMany({ where: { userId: { in: ids } } });
      await database.trustPolicyState.deleteMany({
        where: { singletonId: "global" },
      });
      await database.trustRuleVersion.deleteMany({
        where: { operatorId: operator.id },
      });
      await database.user.deleteMany({ where: { id: { in: ids } } });
    }
  });
});
