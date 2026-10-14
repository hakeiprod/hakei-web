"use server";
import { z } from "zod";
import { prisma } from "@/prisma";
import { runAction } from "@/server/action-result";
import * as proposals from "@/server/proposals";
import { mergeProposal as merge } from "@/server/merge-proposal";
import { archiveScore as archive } from "@/server/score-archive";
import { createScore as create } from "@/server/score-creation";
import { scoreGitStore } from "@/server/score-reader";
export async function saveDraft(input: unknown) {
  return runAction((actor) =>
    proposals.saveDraft(prisma, scoreGitStore(), {
      ...z
        .object({
          scoreId: z.int().positive(),
          baseRevisionId: z.string(),
          candidate: z.json(),
          summary: z.string().min(1).max(2000),
          key: z.string(),
          proposalId: z.string().optional(),
          expectedVersion: z.int().nonnegative().optional(),
        })
        .parse(input),
      actorId: actor.id,
    }),
  );
}
export async function submitProposal(input: unknown) {
  return runAction((actor) =>
    proposals.submitProposal(prisma, {
      ...z
        .object({
          proposalId: z.string(),
          expectedVersion: z.int().nonnegative(),
        })
        .parse(input),
      actorId: actor.id,
    }),
  );
}
export async function mergeProposal(input: unknown) {
  return runAction((actor) =>
    merge(prisma, scoreGitStore(), {
      ...z
        .object({
          proposalId: z.string(),
          expectedProposalVersion: z.int().nonnegative(),
          expectedRevisionId: z.string(),
          expectedRepositoryCommitOid: z.string().regex(/^[a-f0-9]{40}$/),
          key: z.string(),
        })
        .parse(input),
      actorId: actor.id,
    }),
  );
}
export async function closeProposal(input: unknown) {
  return runAction((actor) =>
    proposals.closeProposal(prisma, {
      ...z
        .object({
          proposalId: z.string(),
          expectedVersion: z.int().nonnegative(),
          decision: z.enum(["REJECTED", "WITHDRAWN"]),
          reason: z.string().min(1).max(2000),
          key: z.string(),
        })
        .parse(input),
      actorId: actor.id,
    }),
  );
}
export async function archiveScore(input: unknown) {
  return runAction((actor) =>
    archive(prisma, {
      ...z
        .object({
          scoreId: z.int().positive(),
          expectedRevisionId: z.string(),
          key: z.string(),
        })
        .parse(input),
      actorId: actor.id,
    }),
  );
}
export async function createScore(input: unknown) {
  return runAction((actor) =>
    create(prisma, scoreGitStore(), {
      ...z
        .object({
          repositoryId: z.string(),
          candidate: z.json(),
          key: z.string(),
        })
        .parse(input),
      actorId: actor.id,
    }),
  );
}
