import type { Prisma } from "@/generated/prisma/client";
import "server-only";
import { repositoryAccess } from "./authorization";
import { payloadHash } from "./contracts";
import { GitStore } from "./git-store";
import {
  readRevisionArtifacts,
  type RevisionArtifacts,
} from "./revision-validation";
export type ReaderDatabase = Pick<
  Prisma.TransactionClient,
  "score" | "scoreRepository" | "repositoryMember" | "scoreRevision"
>;
export type ScoreDto = {
  id: number;
  repositoryId: string;
  revisionId: string;
  revisionNumber: number;
  data: unknown;
  canEdit: boolean;
  canManage: boolean;
  requiresAuthentication: boolean;
  artifacts?: RevisionArtifacts;
};
export function scoreGitStore() {
  const root = process.env.SCORE_GIT_ROOT;
  if (!root) throw new Error("SCORE_GIT_ROOT is required");
  return new GitStore(root);
}
export async function readScore(
  database: ReaderDatabase,
  git: GitStore,
  scoreId: number,
  actorId?: string,
  revisionId?: string,
): Promise<ScoreDto> {
  if (!Number.isSafeInteger(scoreId) || scoreId <= 0)
    throw new Error("NOT_FOUND");
  const score = await database.score.findUnique({ where: { id: scoreId } });
  if (
    !score ||
    score.archivedAt ||
    !score.repositoryId ||
    !score.currentRevisionId
  )
    throw new Error("NOT_FOUND");
  const access = await repositoryAccess(database, score.repositoryId, actorId);
  const revision = await database.scoreRevision.findFirst({
    where: {
      id: revisionId ?? score.currentRevisionId,
      scoreId,
      repositoryId: score.repositoryId,
    },
  });
  if (!revision) throw new Error("NOT_FOUND");
  if (revision.path !== `scores/${scoreId}/score.json`)
    throw new Error("INVALID_REVISION_INDEX");
  const data = await git.readJson(
    access.repository.gitStorageKey,
    revision.commitOid,
    revision.path,
  );
  if (payloadHash(data) !== revision.dataHash)
    throw new Error("INVALID_REVISION_INDEX");
  const artifacts = await readRevisionArtifacts(
    git,
    access.repository.gitStorageKey,
    revision.commitOid,
    scoreId,
  );
  return {
    artifacts,
    id: score.id,
    repositoryId: score.repositoryId,
    revisionId: revision.id,
    revisionNumber: revision.number,
    data,
    canEdit: access.canEdit,
    canManage: access.canManage,
    requiresAuthentication: access.repository.visibility !== "PUBLIC",
  };
}
export async function listScores(
  database: ReaderDatabase,
  actorId?: string,
  cursor?: number,
) {
  const memberships = actorId
    ? await database.repositoryMember.findMany({
        where: { userId: actorId },
        select: { repositoryId: true, role: true },
      })
    : [];
  const readable: Prisma.ScoreRepositoryWhereInput[] = [
    { visibility: "PUBLIC" },
  ];
  if (actorId)
    readable.push(
      { ownerId: actorId },
      {
        visibility: "INVITED",
        id: { in: memberships.map((member) => member.repositoryId) },
      },
      {
        visibility: "PRIVATE",
        id: {
          in: memberships
            .filter((member) => member.role === "ADMIN")
            .map((member) => member.repositoryId),
        },
      },
    );
  const repositories = await database.scoreRepository.findMany({
    where: { archivedAt: null, ownerId: { not: null }, OR: readable },
    select: { id: true, name: true },
  });
  const scores = await database.score.findMany({
    where: {
      archivedAt: null,
      repositoryId: { in: repositories.map((repository) => repository.id) },
      currentRevisionId: { not: null },
      ...(cursor ? { id: { gt: cursor } } : {}),
    },
    orderBy: { id: "asc" },
    take: 50,
    select: { id: true, repositoryId: true, currentRevisionId: true },
  });
  return scores.map((score) => ({
    id: score.id,
    repositoryId: score.repositoryId!,
    revisionId: score.currentRevisionId!,
    repositoryName: repositories.find(
      (repository) => repository.id === score.repositoryId,
    )!.name,
  }));
}
