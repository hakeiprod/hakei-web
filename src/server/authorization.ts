import "server-only";
import type { Prisma } from "@/generated/prisma/client";

export type AccessDatabase = Pick<
  Prisma.TransactionClient,
  "scoreRepository" | "repositoryMember"
>;
export async function repositoryAccess(
  database: AccessDatabase,
  repositoryId: string,
  actorId?: string,
) {
  const repository = await database.scoreRepository.findUnique({
    where: { id: repositoryId },
  });
  if (!repository || repository.archivedAt) throw new Error("NOT_FOUND");
  const member = actorId
    ? await database.repositoryMember.findUnique({
        where: { repositoryId_userId: { repositoryId, userId: actorId } },
      })
    : null;
  const owner = actorId !== undefined && repository.ownerId === actorId;
  const invited = owner || member !== null;
  const canManage = owner || member?.role === "ADMIN";
  const canRead =
    repository.visibility === "PUBLIC" ||
    (repository.visibility === "PRIVATE" ? canManage : invited);
  if (!canRead) throw new Error("NOT_FOUND");
  const canEdit =
    !!actorId &&
    ((repository.editScope === "ALL_USERS" &&
      repository.visibility === "PUBLIC") ||
      canManage ||
      member?.role === "EDITOR");
  return {
    repository,
    member,
    canRead,
    canManage,
    canEdit,
    canMergeInvited:
      repository.editScope === "INVITED" &&
      (canManage || (member?.role === "EDITOR" && member.canMerge)),
  };
}
