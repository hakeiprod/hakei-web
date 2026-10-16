import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { withMaintenanceGate } from "../maintenance-freeze";
import { withWriteLease } from "../maintenance-gate";
import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { withTestConnections } from "../testing/database";
import { revokeLegacyAuthentication } from "./cutover";
import { createSession, validateSession } from "./sessions";
it("revokes old and restored sessions without deleting users, roles or owned repositories", () =>
  withTestConnections(async (database) => {
    const root = await mkdtemp(path.join(tmpdir(), "hakei-cutover-"));
    const user = await database.user.create({
      data: { serviceRole: "OPERATOR" },
    });
    const repository = await database.scoreRepository.create({
      data: {
        name: "cutover fixture",
        gitStorageKey: randomUUID(),
        ownerId: user.id,
      },
    });
    try {
      await database.session.create({
        data: {
          userId: user.id,
          sessionToken: randomUUID(),
          expires: new Date(Date.now() + 60_000),
        },
      });
      const session = await createSession(database, {
        userId: user.id,
        authVersion: 0,
        method: "github",
      });
      const before = await database.user.count();
      await withMaintenanceGate(root, async () => {
        await expect(withWriteLease(root, async () => true)).rejects.toThrow(
          "MAINTENANCE",
        );
        return revokeLegacyAuthentication(database);
      });
      expect(
        await validateSession(database, {
          sub: user.id,
          sid: session.sid,
          authVersion: 0,
        }),
      ).toBeNull();
      expect(await database.session.count()).toBe(0);
      expect(await database.user.count()).toBe(before);
      const preserved = await database.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(preserved.serviceRole).toBe("OPERATOR");
      expect(preserved.authVersion).toBe(1);
      const restored = await createSession(database, {
        userId: user.id,
        authVersion: 1,
        method: "github",
      });
      await withMaintenanceGate(root, async () => {
        await expect(withWriteLease(root, async () => true)).rejects.toThrow(
          "MAINTENANCE",
        );
        return revokeLegacyAuthentication(database);
      });
      expect(
        await validateSession(database, {
          sub: user.id,
          sid: restored.sid,
          authVersion: 1,
        }),
      ).toBeNull();
      const owned = await database.scoreRepository.findUniqueOrThrow({
        where: { id: repository.id },
      });
      expect(owned.ownerId).toBe(user.id);
    } finally {
      await database.scoreRepository.delete({ where: { id: repository.id } });
      await database.user.delete({ where: { id: user.id } });
      await rm(root, { recursive: true, force: true });
    }
  }));
