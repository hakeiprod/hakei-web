import "server-only";
import { z } from "zod";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { repositoryAccess } from "./authorization";
import { readScore } from "./score-reader";
import { GitStore } from "./git-store";
import { mutationKeySchema, payloadHash } from "./contracts";
type HistoryDatabase = Pick<
  Prisma.TransactionClient,
  | "practiceSession"
  | "achievement"
  | "scoreRepository"
  | "repositoryMember"
  | "score"
>;
const summarySchema = z.object({
  pitchAccuracy: z.number().finite().nullable(),
  meanAbsTimingUs: z.number().finite().nullable(),
});
const include = {
  evaluation: true,
  scoreRevision: {
    select: { scoreId: true, repositoryId: true, number: true },
  },
  rule: { select: { version: true } },
  achievements: { select: { type: true } },
} satisfies Prisma.PracticeSessionInclude;
type RecordRow = Prisma.PracticeSessionGetPayload<{ include: typeof include }>;
function quality(row: RecordRow) {
  const summary = summarySchema.parse(row.evaluation?.summary);
  return row.mode === "GAME"
    ? { primary: row.evaluation?.score ?? -Infinity, timing: 0 }
    : {
        primary: summary.pitchAccuracy ?? -Infinity,
        timing: -(summary.meanAbsTimingUs ?? Infinity),
      };
}
function isBetter(candidate: RecordRow, best: RecordRow) {
  const candidateQuality = quality(candidate);
  const bestQuality = quality(best);
  return (
    candidateQuality.primary > bestQuality.primary ||
    (candidateQuality.primary === bestQuality.primary &&
      candidateQuality.timing > bestQuality.timing)
  );
}
async function completed(database: HistoryDatabase, userId: string) {
  return database.practiceSession.findMany({
    where: { userId, status: "COMPLETED", evaluation: { isNot: null } },
    include,
    orderBy: [{ startedAt: "asc" }, { id: "asc" }],
  });
}
function bestRecords(rows: RecordRow[]) {
  const best = new Map<string, RecordRow>();
  for (const row of rows) {
    const prior = best.get(row.comparisonKey);
    if (!prior || isBetter(row, prior)) best.set(row.comparisonKey, row);
  }
  return best;
}
/** Rebuild from retained completed sessions inside the same transaction as save/delete. */
export async function recomputeAchievements(
  database: HistoryDatabase,
  userId: string,
) {
  const rows = await completed(database, userId);
  const best = new Map<string, RecordRow>();
  await database.achievement.deleteMany({ where: { userId } });
  const achievements: {
    userId: string;
    type: string;
    comparisonKey: string;
    sessionId: string;
  }[] = [];
  if (rows[0])
    achievements.push({
      userId,
      type: "FIRST_COMPLETION",
      comparisonKey: rows[0].comparisonKey,
      sessionId: rows[0].id,
    });
  for (const row of rows) {
    const prior = best.get(row.comparisonKey);
    if (!prior || isBetter(row, prior)) {
      best.set(row.comparisonKey, row);
      achievements.push({
        userId,
        type: "PERSONAL_BEST",
        comparisonKey: row.comparisonKey,
        sessionId: row.id,
      });
    }
  }
  if (achievements.length > 0)
    await database.achievement.createMany({ data: achievements });
}
async function canRead(
  database: HistoryDatabase,
  row: RecordRow,
  actorId: string,
) {
  const score = await database.score.findUnique({
    where: { id: row.scoreRevision.scoreId },
    select: { archivedAt: true },
  });
  if (!score || score.archivedAt) return false;
  try {
    await repositoryAccess(database, row.scoreRevision.repositoryId, actorId);
    return true;
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") return false;
    throw error;
  }
}
async function item(
  database: HistoryDatabase,
  row: RecordRow,
  actorId: string,
  best: Map<string, RecordRow>,
) {
  return {
    id: row.id,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    scoreId: row.scoreRevision.scoreId,
    revisionId: row.scoreRevisionId,
    revisionNumber: row.scoreRevision.number,
    comparisonKey: row.comparisonKey,
    conditions: {
      trackId: row.trackId,
      rangeStartBar: row.rangeStartBar,
      rangeEndBar: row.rangeEndBar,
      tempoScale: row.tempoScale,
      calibrationUs: row.calibrationUs,
      mode: row.mode,
      ruleVersion: row.rule.version,
    },
    summary: summarySchema.parse(row.evaluation!.summary),
    score: row.evaluation!.score,
    canReadScore: await canRead(database, row, actorId),
    isBest: best.get(row.comparisonKey)?.id === row.id,
    achievements: row.achievements.map((value) => value.type),
  };
}
export async function listPractice(
  database: PrismaClient,
  actorId: string,
  raw: unknown,
) {
  const input = z
    .object({
      cursor: z.string().optional(),
      comparisonKey: z.string().optional(),
    })
    .strict()
    .parse(raw);
  return database.$transaction(
    async (transaction) => {
      if (
        input.cursor &&
        !(await transaction.practiceSession.findFirst({
          where: { id: input.cursor, userId: actorId },
        }))
      )
        throw new Error("NOT_FOUND");
      const all = await completed(transaction, actorId);
      const best = bestRecords(all);
      const rows = await transaction.practiceSession.findMany({
        where: {
          userId: actorId,
          status: { in: ["COMPLETED", "INTERRUPTED"] },
          evaluation: { isNot: null },
          ...(input.comparisonKey
            ? { comparisonKey: input.comparisonKey }
            : {}),
        },
        include,
        orderBy: [{ startedAt: "desc" }, { id: "desc" }],
        take: 51,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });
      return {
        items: await Promise.all(
          rows.slice(0, 50).map((row) => item(transaction, row, actorId, best)),
        ),
        nextCursor: rows.length > 50 ? rows[49].id : null,
        completedCount: all.filter(
          (row) =>
            !input.comparisonKey || row.comparisonKey === input.comparisonKey,
        ).length,
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
export async function readPractice(
  database: PrismaClient,
  git: GitStore,
  actorId: string,
  sessionId: string,
) {
  const row = await database.practiceSession.findFirst({
    where: {
      id: sessionId,
      userId: actorId,
      status: { in: ["COMPLETED", "INTERRUPTED"] },
      evaluation: { isNot: null },
    },
    include,
  });
  if (!row) throw new Error("NOT_FOUND");
  const best = bestRecords(await completed(database, actorId));
  const score = await readScore(
    database,
    git,
    row.scoreRevision.scoreId,
    actorId,
    row.scoreRevisionId,
  ).catch((error) => {
    if (error instanceof Error && error.message === "NOT_FOUND") return null;
    throw error;
  });
  return {
    ...(await item(database, row, actorId, best)),
    score,
    evaluation: row.evaluation!,
  };
}
export async function deletePractice(
  database: PrismaClient,
  actorId: string,
  raw: unknown,
) {
  const input = z
    .object({ sessionId: z.string().min(1), key: mutationKeySchema })
    .strict()
    .parse(raw);
  const hash = payloadHash({ sessionId: input.sessionId });
  return database.$transaction(
    async (transaction) => {
      const receipt = await transaction.mutationReceipt.findUnique({
        where: {
          actorId_operation_key: {
            actorId,
            operation: "DELETE_PRACTICE",
            key: input.key,
          },
        },
      });
      if (receipt) {
        if (receipt.payloadHash !== hash) throw new Error("CONFLICT");
        return { deleted: true as const };
      }
      const session = await transaction.practiceSession.findFirst({
        where: { id: input.sessionId, userId: actorId },
      });
      if (!session) throw new Error("NOT_FOUND");
      await transaction.practiceSession.delete({ where: { id: session.id } });
      await recomputeAchievements(transaction, actorId);
      await transaction.mutationReceipt.create({
        data: {
          actorId,
          operation: "DELETE_PRACTICE",
          key: input.key,
          payloadHash: hash,
          status: "APPLIED",
          stage: "DB_ACCEPTED",
          result: { deleted: true },
        },
      });
      return { deleted: true as const };
    },
    { isolationLevel: "Serializable" },
  );
}
