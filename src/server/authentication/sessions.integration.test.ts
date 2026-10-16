import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { withTestConnections } from "../testing/database";
import {
  createSession,
  validateSession,
  revokeSession,
  revokeAllSessions,
  lockSession,
} from "./sessions";

it("rejects missing, expired, individually revoked and stale-generation sessions", () =>
  withTestConnections(async (database) => {
    const user = await database.user.create({
      data: { email: `${randomUUID()}@example.invalid` },
    });
    await database.passwordCredential.create({
      data: { userId: user.id, passwordHash: "test-only-hash" },
    });
    try {
      const session = await createSession(database, {
        userId: user.id,
        authVersion: 0,
        method: "credentials",
        credentialVersion: 1,
      });
      const token = { sub: user.id, sid: session.sid, authVersion: 0 };
      expect(await validateSession(database, token)).not.toBeNull();
      expect(
        await validateSession(database, { ...token, sid: randomUUID() }),
      ).toBeNull();
      expect(
        await validateSession(database, { ...token, sub: randomUUID() }),
      ).toBeNull();
      expect(
        await validateSession(database, { ...token, authVersion: 1 }),
      ).toBeNull();
      await database.authSessionRecord.update({
        where: { sid: session.sid },
        data: { expiresAt: new Date(0) },
      });
      expect(await validateSession(database, token)).toBeNull();
      const current = await createSession(database, {
        userId: user.id,
        authVersion: 0,
        method: "credentials",
        credentialVersion: 1,
      });
      await revokeSession(database, current.sid);
      expect(
        await validateSession(database, { ...token, sid: current.sid }),
      ).toBeNull();
      const remaining = await Promise.all(
        [0, 1].map(() =>
          createSession(database, {
            userId: user.id,
            authVersion: 0,
            method: "credentials",
            credentialVersion: 1,
          }),
        ),
      );
      await expect(
        createSession(database, {
          userId: user.id,
          authVersion: 0,
          method: "credentials",
          credentialVersion: 0,
        }),
      ).rejects.toThrow();
      await database.$transaction((tx) => revokeAllSessions(tx, user.id));
      for (const record of remaining)
        expect(
          await validateSession(database, { ...token, sid: record.sid }),
        ).toBeNull();
      await expect(
        createSession(database, {
          userId: user.id,
          authVersion: 0,
          method: "credentials",
          credentialVersion: 1,
        }),
      ).rejects.toThrow();
    } finally {
      await database.user.delete({ where: { id: user.id } });
    }
  }));
it("orders revocation after a protected transaction holding shared user and sid locks", () =>
  withTestConnections(async (first, second) => {
    const user = await first.user.create({
      data: { email: `${randomUUID()}@example.invalid` },
    });
    await first.passwordCredential.create({
      data: { userId: user.id, passwordHash: "test-only-hash" },
    });
    try {
      const session = await createSession(first, {
        userId: user.id,
        authVersion: 0,
        method: "credentials",
        credentialVersion: 1,
      });
      const token = { sub: user.id, sid: session.sid, authVersion: 0 };
      let acquired!: () => void;
      let release!: () => void;
      const ready = new Promise<void>((resolve) => {
        acquired = resolve;
      });
      const wait = new Promise<void>((resolve) => {
        release = resolve;
      });
      const write = first.$transaction(async (tx) => {
        await lockSession(tx, token);
        acquired();
        await wait;
        await tx.user.update({
          where: { id: user.id },
          data: { name: "before revocation" },
        });
      });
      await ready;
      const revocation = second.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '100ms'");
        await revokeAllSessions(tx, user.id);
      });
      try {
        await expect(revocation).rejects.toThrow();
      } finally {
        release();
        await write;
      }
      await second.$transaction((tx) => revokeAllSessions(tx, user.id));
      await expect(
        first.$transaction((tx) => lockSession(tx, token)),
      ).rejects.toThrow();
      const preserved = await first.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(preserved.name).toBe("before revocation");
    } finally {
      await first.user.delete({ where: { id: user.id } });
    }
  }));
