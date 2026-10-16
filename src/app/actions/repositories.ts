"use server";
import { z } from "zod";
import { prisma } from "@/prisma";
import { runAction } from "@/server/action-result";
import * as repositories from "@/server/repositories";
const scope = {
  visibility: z.enum(["PRIVATE", "INVITED", "PUBLIC"]),
  editScope: z.enum(["INVITED", "ALL_USERS"]),
};
export async function createRepository(input: unknown) {
  return runAction((actor) =>
    repositories.createRepository(prisma, {
      ...z
        .object({
          ...scope,
          name: z.string().min(1).max(200),
          key: z.string().min(1).max(128),
        })
        .parse(input),
      actorId: actor.id,
    }),
  );
}
export async function updateRepository(input: unknown) {
  return runAction((actor) =>
    repositories.updateRepository(prisma, {
      ...z
        .object({
          ...scope,
          repositoryId: z.string(),
          expectedAccessVersion: z.int().nonnegative(),
        })
        .parse(input),
      actorId: actor.id,
    }),
  );
}
export async function setMember(input: unknown) {
  return runAction((actor) =>
    repositories.setMember(prisma, {
      ...z
        .object({
          repositoryId: z.string(),
          userId: z.string(),
          role: z.enum(["ADMIN", "EDITOR", "VIEWER", "REMOVE"]),
          canMerge: z.boolean(),
          expectedAccessVersion: z.int().nonnegative(),
        })
        .parse(input),
      actorId: actor.id,
    }),
  );
}
