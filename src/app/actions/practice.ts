"use server";
import { prisma } from "@/prisma";
import { runAction } from "@/server/action-result";
import { scoreGitStore } from "@/server/score-reader";
import {
  beginPractice as begin,
  savePractice as save,
  markPracticeRecording as record,
} from "@/server/practice";
import { z } from "zod";
export async function beginPractice(input: unknown) {
  return runAction((actor) => begin(prisma, scoreGitStore(), actor.id, input));
}
export async function savePractice(input: unknown) {
  return runAction((actor) => save(prisma, scoreGitStore(), actor.id, input));
}
export async function markPracticeRecording(input: unknown) {
  return runAction((actor) =>
    record(
      prisma,
      actor.id,
      z.object({ sessionId: z.string() }).strict().parse(input).sessionId,
    ),
  );
}
