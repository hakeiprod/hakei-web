import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { z } from "zod";
import { defaultEvaluationRule } from "@/s-core/models/practice/default-rule";
/** Spec-defined defaults, independent of operator-configured trust weights. Never changes an existing version. */
export async function initializeEvaluationRule(database: PrismaClient) {
  return database.evaluationRuleVersion.upsert({
    where: { version: 1 },
    update: {},
    create: defaultEvaluationRule,
  });
}
export async function readEvaluationRule(
  database: PrismaClient,
  version: number,
) {
  const rule = await database.evaluationRuleVersion.findUnique({
    where: { version },
  });
  if (!rule) throw new Error("RULE_UNCONFIGURED");
  z.object({
    version: z.literal(1),
    practiceWindowUs: z.literal(150_000),
    perfectWindowUs: z.literal(30_000),
    goodWindowUs: z.literal(60_000),
    extraPenalty: z.literal(1),
    weights: z.object({ perfect: z.literal(1), good: z.literal(0.5) }).strict(),
  }).parse(rule);
  return rule;
}
