"use server";
import { prisma } from "@/prisma";
import { runAction } from "@/server/action-result";
import { scoreGitStore } from "@/server/score-reader";
import {
  listPractice as list,
  readPractice as read,
  deletePractice as remove,
} from "@/server/practice-history";
import { z } from "zod";
export async function listPractice(input: unknown) {
  return runAction((actor) => list(prisma, actor.id, input));
}
export async function readPractice(input: unknown) {
  return runAction((actor) =>
    read(
      prisma,
      scoreGitStore(),
      actor.id,
      z
        .object({ sessionId: z.string().min(1) })
        .strict()
        .parse(input).sessionId,
    ),
  );
}
export async function deletePractice(input: unknown) {
  return runAction((actor) => remove(prisma, actor.id, input));
}
