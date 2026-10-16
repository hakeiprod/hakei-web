import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { withTestConnections } from "../testing/database";
import { createSession, revokeAllSessions } from "./sessions";
import { withActorAuthorization } from "./authorize";
import { createRepository } from "../repositories";

it("rejects protected service writes after revocation even with the old server actor", () =>
  withTestConnections(async (database) => {
    const user = await database.user.create({ data: {} });
    const session = await createSession(database, {
      userId: user.id,
      authVersion: 0,
      method: "github",
    });
    const actor = {
      id: user.id,
      sid: session.sid,
      authVersion: 0,
      serviceRole: user.serviceRole,
    };
    try {
      await database.$transaction((tx) => revokeAllSessions(tx, user.id));
      await expect(
        withActorAuthorization(actor, () =>
          createRepository(database, {
            actorId: user.id,
            name: "rejected",
            visibility: "PUBLIC",
            editScope: "ALL_USERS",
            key: randomUUID(),
          }),
        ),
      ).rejects.toThrow("UNAUTHENTICATED");
      expect(
        await database.scoreRepository.count({ where: { ownerId: user.id } }),
      ).toBe(0);
      expect(
        await database.mutationReceipt.count({ where: { actorId: user.id } }),
      ).toBe(0);
    } finally {
      await database.user.delete({ where: { id: user.id } });
    }
  }));
