"use server";
import { prisma } from "@/prisma";
import { runAction } from "@/server/action-result";
import { scoreGitStore } from "@/server/score-reader";
import { saveImport as save } from "@/server/score-import";
export async function saveImport(input: unknown) {
  return runAction((actor) => save(prisma, scoreGitStore(), actor.id, input));
}
