import "server-only";
import { z } from "zod";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  practiceConditionsSchema,
  performanceEventsSchema,
  performanceEventSchema,
} from "@/s-core/models/practice/contracts";
import * as Practice from "@/s-core/models/practice";
import { Microseconds } from "@/s-core/models/core/units/microseconds";
import { gameEvaluationSchema } from "@/s-core/models/practice/game-contracts";
import { requirePlayableRevision } from "./practice-access";
import { readEvaluationRule } from "./evaluation-rule";
import { repositoryAccess } from "./authorization";
import { payloadHash } from "./contracts";
import { recomputeAchievements } from "./practice-history";
import { GitStore } from "./git-store";
const identity = {
  clientSessionId: z.string().min(1).max(128),
  scoreId: z.int().positive(),
  scoreRevisionId: z.string().min(1),
  conditions: practiceConditionsSchema,
  deviceLabel: z.string().max(200).optional(),
};
const beginSchema = z.object(identity).strict();
const submissionSchema = z
  .object({
    ...identity,
    status: z.enum(["COMPLETED", "INTERRUPTED"]),
    endedUs: z.int().nonnegative().max(1_801_200_000),
    eventBatches: z
      .array(
        z
          .object({
            batchIndex: z.int().nonnegative(),
            events: z.array(performanceEventSchema).max(1000),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
async function setup(
  database: PrismaClient,
  git: GitStore,
  actorId: string,
  input: z.infer<typeof beginSchema>,
) {
  const score = await requirePlayableRevision(
    database,
    git,
    input.scoreId,
    actorId,
    input.scoreRevisionId,
    input.conditions.mode,
  );
  const rule = await readEvaluationRule(database, input.conditions.ruleVersion);
  const conditions = Practice.Conditions.import(input.conditions);
  const model = Practice.Timeline.create(score.data, conditions);
  const timeline = model.export();
  const evaluator = new Practice.Evaluator(model, conditions, rule);
  if (timeline.notes.length === 0) throw new Error("EMPTY_RANGE");
  const comparisonKey = payloadHash({
    scoreRevisionId: score.revisionId,
    ruleId: rule.id,
    ...input.conditions,
  });
  return { score, rule, timeline, evaluator, comparisonKey };
}
async function authorize(
  transaction: Prisma.TransactionClient,
  actorId: string,
  repositoryId: string,
  scoreId: number,
) {
  await repositoryAccess(transaction, repositoryId, actorId);
  const score = await transaction.score.findUnique({ where: { id: scoreId } });
  if (!score || score.archivedAt || score.repositoryId !== repositoryId)
    throw new Error("NOT_FOUND");
}
function sessionData(
  actorId: string,
  input: z.infer<typeof beginSchema>,
  ruleId: string,
  comparisonKey: string,
) {
  const {
    trackId,
    rangeStartBar,
    rangeEndBar,
    tempoScale,
    calibrationUs,
    mode,
  } = input.conditions;
  const conditions = {
    trackId,
    rangeStartBar,
    rangeEndBar,
    tempoScale,
    calibrationUs,
    mode,
  };
  return {
    userId: actorId,
    clientSessionId: input.clientSessionId,
    scoreRevisionId: input.scoreRevisionId,
    ...conditions,
    ruleId,
    comparisonKey,
    deviceLabel: input.deviceLabel,
  };
}
export async function beginPractice(
  database: PrismaClient,
  git: GitStore,
  actorId: string,
  raw: unknown,
) {
  const input = beginSchema.parse(raw);
  const prepared = await setup(database, git, actorId, input);
  const session = await database.$transaction(
    async (transaction) => {
      await authorize(
        transaction,
        actorId,
        prepared.score.repositoryId,
        prepared.score.id,
      );
      const existing = await transaction.practiceSession.findUnique({
        where: {
          userId_clientSessionId: {
            userId: actorId,
            clientSessionId: input.clientSessionId,
          },
        },
      });
      if (existing) {
        if (existing.comparisonKey !== prepared.comparisonKey)
          throw new Error("CONFLICT");
        return existing;
      }
      return transaction.practiceSession.create({
        data: sessionData(
          actorId,
          input,
          prepared.rule.id,
          prepared.comparisonKey,
        ),
      });
    },
    { isolationLevel: "Serializable" },
  );
  return {
    sessionId: session.id,
    status: session.status,
    rule: {
      id: prepared.rule.id,
      version: prepared.rule.version,
      practiceWindowUs: prepared.rule.practiceWindowUs,
      perfectWindowUs: prepared.rule.perfectWindowUs,
      goodWindowUs: prepared.rule.goodWindowUs,
    },
    timeline: prepared.timeline,
  };
}
export async function markPracticeRecording(
  database: PrismaClient,
  actorId: string,
  sessionId: string,
) {
  const session = await database.practiceSession.findFirst({
    where: { id: sessionId, userId: actorId },
    include: { scoreRevision: true },
  });
  if (!session) throw new Error("NOT_FOUND");
  return database.$transaction(async (transaction) => {
    await authorize(
      transaction,
      actorId,
      session.scoreRevision.repositoryId,
      session.scoreRevision.scoreId,
    );
    const changed = await transaction.practiceSession.updateMany({
      where: { id: sessionId, userId: actorId, status: "CREATED" },
      data: { status: "RECORDING" },
    });
    if (changed.count !== 1 && session.status !== "RECORDING")
      throw new Error("CONFLICT");
    return { sessionId, status: "RECORDING" };
  });
}
function dto(
  session: { id: string; status: string },
  evaluation: {
    summary: Prisma.JsonValue;
    perNote: Prisma.JsonValue;
    perBar: Prisma.JsonValue;
    score: number | null;
    meanAbsTimingUs: number | null;
  },
  achievements: { type: string }[] = [],
) {
  return {
    achievements: achievements.map((value) => value.type),
    sessionId: session.id,
    status: session.status,
    evaluation: {
      summary: evaluation.summary,
      perNote: evaluation.perNote,
      perBar: evaluation.perBar,
      score: evaluation.score,
      meanAbsTimingUs: evaluation.meanAbsTimingUs,
    },
  };
}
export async function savePractice(
  database: PrismaClient,
  git: GitStore,
  actorId: string,
  raw: unknown,
) {
  const input = submissionSchema.parse(raw);
  const prepared = await setup(database, git, actorId, input);
  const windowUs =
    input.conditions.mode === "GAME"
      ? prepared.rule.goodWindowUs
      : prepared.rule.practiceWindowUs;
  const batches = input.eventBatches.toSorted(
    (a, b) => a.batchIndex - b.batchIndex,
  );
  if (batches.some((batch, index) => batch.batchIndex !== index))
    throw new Error("INVALID_BATCH_ORDER");
  const events = performanceEventsSchema.parse(
    batches.flatMap((batch) => batch.events),
  );
  if (events.some((event) => event.relativeUs > input.endedUs))
    throw new Error("INVALID_EVENT_TIME");
  const submissionHash = payloadHash({
    ...input,
    eventBatches: batches,
    deviceLabel: input.deviceLabel ?? null,
  });
  const prior = await database.practiceSession.findUnique({
    where: {
      userId_clientSessionId: {
        userId: actorId,
        clientSessionId: input.clientSessionId,
      },
    },
  });
  if (prior?.submissionHash) {
    if (prior.submissionHash !== submissionHash) throw new Error("CONFLICT");
    return dto(
      prior,
      await database.evaluationResult.findUniqueOrThrow({
        where: { sessionId: prior.id },
      }),
      await database.achievement.findMany({
        where: { sessionId: prior.id },
        select: { type: true },
        orderBy: { type: "asc" },
      }),
    );
  }
  const open = new Map<string, number[]>();
  for (const event of events) {
    const key = `${event.channel}:${event.pitch}`;
    const queue = open.get(key) ?? [];
    if (event.type === "NOTE_ON") queue.push(event.sequence);
    else queue.shift();
    open.set(key, queue);
  }
  const openNotes = [...open.values()].flat();
  if (input.status === "COMPLETED" && openNotes.length > 0)
    throw new Error("OPEN_NOTES");
  if (
    input.status === "COMPLETED" &&
    input.endedUs <
      prepared.timeline.durationUs +
        windowUs +
        Math.max(0, input.conditions.calibrationUs)
  )
    throw new Error("SESSION_INCOMPLETE");
  const result = prepared.evaluator.evaluate(
    Practice.Performance.import(events),
    {
      phase: input.status,
      endedUs: new Microseconds(input.endedUs),
    },
  );
  const analysis = result.analysis;
  const game = result.game ? gameEvaluationSchema.parse(result.game) : null;
  const summary = {
    ...analysis.summary,
    openNotes,
    endedUs: input.endedUs,
    ...(game ? { game } : {}),
  };
  return database.$transaction(
    async (transaction) => {
      await authorize(
        transaction,
        actorId,
        prepared.score.repositoryId,
        prepared.score.id,
      );
      let session = await transaction.practiceSession.findUnique({
        where: {
          userId_clientSessionId: {
            userId: actorId,
            clientSessionId: input.clientSessionId,
          },
        },
      });
      if (session) {
        if (session.comparisonKey !== prepared.comparisonKey)
          throw new Error("CONFLICT");
        if (session.submissionHash) {
          if (session.submissionHash !== submissionHash)
            throw new Error("CONFLICT");
          const evaluation =
            await transaction.evaluationResult.findUniqueOrThrow({
              where: { sessionId: session.id },
            });
          return dto(
            session,
            evaluation,
            await transaction.achievement.findMany({
              where: { sessionId: session.id },
              select: { type: true },
              orderBy: { type: "asc" },
            }),
          );
        }
        if (!["CREATED", "RECORDING"].includes(session.status))
          throw new Error("CONFLICT");
      } else
        session = await transaction.practiceSession.create({
          data: sessionData(
            actorId,
            input,
            prepared.rule.id,
            prepared.comparisonKey,
          ),
        });
      await transaction.practiceSession.update({
        where: { id: session.id },
        data: { status: "RECORDING" },
      });
      for (const batch of batches) {
        const checksum = payloadHash(batch.events);
        const existing = await transaction.performanceEventBatch.findUnique({
          where: {
            sessionId_batchIndex: {
              sessionId: session.id,
              batchIndex: batch.batchIndex,
            },
          },
        });
        if (existing) {
          if (existing.checksum !== checksum) throw new Error("CONFLICT");
        } else
          await transaction.performanceEventBatch.create({
            data: {
              sessionId: session.id,
              batchIndex: batch.batchIndex,
              events: batch.events,
              checksum,
            },
          });
      }
      const evaluation = await transaction.evaluationResult.create({
        data: {
          sessionId: session.id,
          algorithmVersion: game ? "game-eval-v1" : "practice-eval-v1",
          summary,
          perNote: analysis.perNote as unknown as Prisma.InputJsonValue,
          perBar: analysis.perBar,
          score: input.status === "COMPLETED" ? (game?.score ?? null) : null,
          meanAbsTimingUs: analysis.summary.meanAbsTimingUs,
        },
      });
      const final = await transaction.practiceSession.update({
        where: { id: session.id },
        data: {
          status: input.status,
          submissionHash,
          endedUs: input.endedUs,
          endedAt: new Date(),
        },
      });
      await recomputeAchievements(transaction, actorId);
      return dto(
        final,
        evaluation,
        await transaction.achievement.findMany({
          where: { sessionId: final.id },
          select: { type: true },
          orderBy: { type: "asc" },
        }),
      );
    },
    { isolationLevel: "Serializable" },
  );
}
