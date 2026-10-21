import { expect, test } from "vitest";
import { withTestConnections } from "./testing/database";
import { createRepository, setMember, updateRepository } from "./repositories";
import { repositoryAccess } from "./authorization";
test("scope changes and membership require a current administrator and a matching version", async () => {
  await withTestConnections(async (database) => {
    const owner = await database.user.create({ data: {} });
    const user = await database.user.create({ data: {} });
    let repositoryId: string | undefined;
    try {
      await expect(
        createRepository(database, {
          actorId: owner.id,
          name: "Invalid",
          visibility: "PRIVATE",
          editScope: "ALL_USERS",
          key: "invalid",
        }),
      ).rejects.toThrow();
      const input = {
        actorId: owner.id,
        name: "Music",
        visibility: "PRIVATE" as const,
        editScope: "INVITED" as const,
        key: "create",
      };
      const created = (await createRepository(database, input)) as {
        repositoryId: string;
      };
      repositoryId = created.repositoryId;
      expect(await createRepository(database, input)).toEqual(created);
      await expect(
        setMember(database, {
          actorId: owner.id,
          repositoryId,
          userId: owner.id,
          role: "REMOVE",
          canMerge: false,
          expectedAccessVersion: 0,
        }),
      ).rejects.toThrow("OWNER_ADMIN_REQUIRED");
      await updateRepository(database, {
        actorId: owner.id,
        repositoryId,
        expectedAccessVersion: 0,
        visibility: "INVITED",
        editScope: "INVITED",
      });
      await setMember(database, {
        actorId: owner.id,
        repositoryId,
        userId: user.id,
        role: "EDITOR",
        canMerge: false,
        expectedAccessVersion: 1,
      });
      const editable = await repositoryAccess(database, repositoryId, user.id);
      expect(editable.canEdit).toBe(true);
      expect(editable.canMergeInvited).toBe(false);
      await expect(
        setMember(database, {
          actorId: user.id,
          repositoryId,
          userId: user.id,
          role: "ADMIN",
          canMerge: true,
          expectedAccessVersion: 2,
        }),
      ).rejects.toThrow("FORBIDDEN");
      await expect(
        updateRepository(database, {
          actorId: owner.id,
          repositoryId,
          expectedAccessVersion: 1,
          visibility: "PUBLIC",
          editScope: "ALL_USERS",
        }),
      ).rejects.toThrow("CONFLICT");
      await setMember(database, {
        actorId: owner.id,
        repositoryId,
        userId: user.id,
        role: "REMOVE",
        canMerge: false,
        expectedAccessVersion: 2,
      });
      await expect(
        repositoryAccess(database, repositoryId, user.id),
      ).rejects.toThrow("NOT_FOUND");
    } finally {
      await database.auditEvent.deleteMany({
        where: { actorId: { in: [owner.id, user.id] } },
      });
      await database.mutationReceipt.deleteMany({
        where: { actorId: { in: [owner.id, user.id] } },
      });
      if (repositoryId) {
        await database.repositoryMember.deleteMany({ where: { repositoryId } });
        await database.scoreRepository.delete({ where: { id: repositoryId } });
      }
      await database.user.deleteMany({
        where: { id: { in: [owner.id, user.id] } },
      });
    }
  });
});
