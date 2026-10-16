import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { withTestConnections } from "../testing/database";
import { cleanupAuthentication } from "./cleanup";
import { issueChallenge } from "./challenges";
import { createSession } from "./sessions";
it("removes expired authentication data while retaining live links and current users", () =>
  withTestConnections(async (database) => {
    const emails = [randomUUID(), randomUUID()].map(
      (id) => `${id}@example.invalid`,
    );
    const old = await database.emailIdentity.create({
      data: { normalizedEmail: emails[0], state: "PENDING" },
    });
    const live = await database.emailIdentity.create({
      data: { normalizedEmail: emails[1], state: "PENDING" },
    });
    const user = await database.user.create({ data: {} });
    try {
      const expired = await issueChallenge(database, {
        identityId: old.id,
        purpose: "VERIFY",
        emailSnapshot: emails[0],
      });
      const active = await issueChallenge(database, {
        identityId: live.id,
        purpose: "VERIFY",
        emailSnapshot: emails[1],
      });
      await database.authChallenge.update({
        where: { id: expired.id },
        data: { expiresAt: new Date(Date.now() - 8 * 24 * 60 * 60_000) },
      });
      const session = await createSession(database, {
        userId: user.id,
        authVersion: 0,
        method: "github",
      });
      const expiredSid = await createSession(database, {
        userId: user.id,
        authVersion: 0,
        method: "github",
      });
      await database.authSessionRecord.update({
        where: { sid: expiredSid.sid },
        data: { revokedAt: new Date(Date.now() - 8 * 24 * 60 * 60_000) },
      });
      await cleanupAuthentication(database);
      expect(
        await database.emailIdentity.findUnique({ where: { id: old.id } }),
      ).toBeNull();
      expect(
        await database.authChallenge.findUnique({ where: { id: active.id } }),
      ).not.toBeNull();
      expect(
        await database.authSessionRecord.findUnique({
          where: { sid: session.sid },
        }),
      ).not.toBeNull();
      expect(
        await database.authSessionRecord.findUnique({
          where: { sid: expiredSid.sid },
        }),
      ).toBeNull();
      expect(
        await database.user.findUnique({ where: { id: user.id } }),
      ).not.toBeNull();
    } finally {
      await database.user.delete({ where: { id: user.id } });
      await database.emailIdentity.deleteMany({
        where: { normalizedEmail: { in: emails } },
      });
    }
  }));
it("retains recent attempts and notices but removes completed retention periods", () =>
  withTestConnections(async (database) => {
    const user = await database.user.create({ data: {} });
    const oldEnd = new Date(Date.now() - 2 * 24 * 60 * 60_000);
    const windows = await Promise.all(
      ["login:mailbox", "login:source"].map((kind) =>
        database.authRateWindow.create({
          data: {
            kind,
            keyDigest: randomUUID(),
            windowStart: new Date(oldEnd.getTime() - 15 * 60_000),
            windowEnd: oldEnd,
            limitSnapshot: 5,
            count: 1,
          },
        }),
      ),
    );
    const attempt = await database.authAttempt.create({
      data: {
        mailboxWindowId: windows[0].id,
        sourceWindowId: windows[1].id,
        deadline: oldEnd,
      },
    });
    const event = await database.authChangeEvent.create({
      data: {
        userId: user.id,
        type: "PASSWORD_CHANGED",
        requestId: randomUUID(),
        occurredAt: new Date(Date.now() - 91 * 24 * 60 * 60_000),
        notice: { create: { recipientSnapshot: "fixture@example.invalid" } },
      },
    });
    const recent = await database.authChangeEvent.create({
      data: {
        userId: user.id,
        type: "PASSWORD_CHANGED",
        requestId: randomUUID(),
        notice: { create: { recipientSnapshot: "fixture@example.invalid" } },
      },
    });
    try {
      await cleanupAuthentication(database);
      expect(
        await database.authAttempt.findUnique({ where: { id: attempt.id } }),
      ).toBeNull();
      expect(
        await database.authRateWindow.count({
          where: { id: { in: windows.map((window) => window.id) } },
        }),
      ).toBe(0);
      expect(
        await database.authNotice.findUnique({ where: { eventId: event.id } }),
      ).toBeNull();
      expect(
        await database.authNotice.findUnique({ where: { eventId: recent.id } }),
      ).not.toBeNull();
    } finally {
      await database.user.delete({ where: { id: user.id } });
      await database.authRateWindow.deleteMany({
        where: { id: { in: windows.map((window) => window.id) } },
      });
    }
  }));
it("does not remove an identity while another connection issues its first challenge", () =>
  withTestConnections(async (database, other) => {
    const email = `${randomUUID()}@example.invalid`;
    const identity = await database.emailIdentity.create({
      data: { normalizedEmail: email, state: "PENDING" },
    });
    let ready!: () => void, release!: () => void;
    const prepared = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const issuance = database.$transaction(async (tx) => {
      const { issueChallengeInTransaction } = await import("./challenges");
      const challenge = await issueChallengeInTransaction(tx, {
        identityId: identity.id,
        purpose: "VERIFY",
        emailSnapshot: email,
      });
      ready();
      await barrier;
      return challenge;
    });
    try {
      await prepared;
      await cleanupAuthentication(other);
      release();
      const challenge = await issuance;
      expect(
        await database.authChallenge.findUnique({
          where: { id: challenge.id },
        }),
      ).not.toBeNull();
    } finally {
      release();
      await issuance;
      await database.emailIdentity.deleteMany({ where: { id: identity.id } });
    }
  }));
it("cascades user-owned session, identity and notice records on user deletion", () =>
  withTestConnections(async (database) => {
    const user = await database.user.create({
      data: {
        emailIdentity: {
          create: {
            normalizedEmail: `${randomUUID()}@example.invalid`,
            state: "OAUTH_BOUND",
          },
        },
      },
    });
    const session = await createSession(database, {
      userId: user.id,
      authVersion: 0,
      method: "github",
    });
    const event = await database.authChangeEvent.create({
      data: {
        userId: user.id,
        type: "PASSWORD_CHANGED",
        requestId: randomUUID(),
        notice: { create: { recipientSnapshot: "fixture@example.invalid" } },
      },
    });
    await database.user.delete({ where: { id: user.id } });
    expect(
      await database.authSessionRecord.findUnique({
        where: { sid: session.sid },
      }),
    ).toBeNull();
    expect(
      await database.emailIdentity.findUnique({ where: { userId: user.id } }),
    ).toBeNull();
    expect(
      await database.authNotice.findUnique({ where: { eventId: event.id } }),
    ).toBeNull();
  }));
