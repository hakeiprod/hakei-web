import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { PrismaClient } from "@/generated/prisma/client";
import * as Core from "@/s-core/models/core";
import "@/s-core/models/core/extensions/to-sheet";
import { withTestConnections } from "./database";
import { GitStore } from "../git-store";
import { createRepository, setMember } from "../repositories";
import { createScore } from "../score-creation";
import { saveDraft, submitProposal } from "../proposals";
export function scoreCandidate(pitch: number) {
  // Exercise the actual serialized transport used by persisted score data.
  // eslint-disable-next-line unicorn/prefer-structured-clone
  return JSON.parse(
    JSON.stringify(
      Core.Score.create({
        tracks: [{ notes: [{ pitch, start: 0, duration: 1 }] }],
      })
        .toSheet()
        .export(),
    ),
  );
}
export type CollaborationFixture = {
  database: PrismaClient;
  second: PrismaClient;
  git: GitStore;
  root: string;
  ownerId: string;
  editorId: string;
  repositoryId: string;
  scoreId: number;
  revisionId: string;
  commitOid: string;
};
export async function submittedDraft(
  fixture: CollaborationFixture,
  actorId: string,
  key: string,
  pitch = 62,
) {
  const draft = (await saveDraft(fixture.database, fixture.git, {
    actorId,
    scoreId: fixture.scoreId,
    baseRevisionId: fixture.revisionId,
    candidate: scoreCandidate(pitch),
    summary: "Correct pitch",
    key,
  })) as { proposalId: string; version: number };
  return submitProposal(fixture.database, {
    actorId,
    proposalId: draft.proposalId,
    expectedVersion: draft.version,
  });
}
export async function withCollaboration(
  run: (fixture: CollaborationFixture) => Promise<void>,
  allUsers = false,
) {
  const root = await mkdtemp(path.join(tmpdir(), "hakei-collaboration-"));
  try {
    await withTestConnections(async (database, second) => {
      const owner = await database.user.create({
        data: { serviceRole: "OPERATOR" },
      });
      const editor = await database.user.create({ data: {} });
      const ids = [owner.id, editor.id];
      let repositoryId: string | undefined;
      try {
        const repository = (await createRepository(database, {
          actorId: owner.id,
          name: "Music",
          visibility: "PUBLIC",
          editScope: allUsers ? "ALL_USERS" : "INVITED",
          key: "repository",
        })) as { repositoryId: string };
        repositoryId = repository.repositoryId;
        await setMember(database, {
          actorId: owner.id,
          repositoryId,
          userId: editor.id,
          role: "EDITOR",
          canMerge: true,
          expectedAccessVersion: 0,
        });
        const git = new GitStore(root);
        const score = (await createScore(database, git, {
          actorId: owner.id,
          repositoryId,
          candidate: scoreCandidate(60),
          key: "score",
        })) as { scoreId: number; revisionId: string; commitOid: string };
        await run({
          database,
          second,
          git,
          root,
          ownerId: owner.id,
          editorId: editor.id,
          repositoryId,
          ...score,
        });
      } finally {
        if (repositoryId) {
          await database.practiceSession.deleteMany({
            where: { scoreRevision: { repositoryId } },
          });
          const scores = await database.score.findMany({
            where: { repositoryId },
            select: { id: true },
          });
          const scoreIds = scores.map((score) => score.id);
          const proposals = await database.editProposal.findMany({
            where: { scoreId: { in: scoreIds } },
            select: { id: true },
          });
          await database.mergeRecord.deleteMany({
            where: {
              proposalId: { in: proposals.map((proposal) => proposal.id) },
            },
          });
          await database.editProposal.deleteMany({
            where: { scoreId: { in: scoreIds } },
          });
          await database.gitPublicationJob.deleteMany({
            where: { repositoryId },
          });
          await database.scoreRevision.deleteMany({ where: { repositoryId } });
          await database.score.deleteMany({ where: { repositoryId } });
          await database.repositoryMember.deleteMany({
            where: { repositoryId },
          });
          await database.scoreRepository.delete({
            where: { id: repositoryId },
          });
        }
        await database.mutationReceipt.deleteMany({
          where: { actorId: { in: ids } },
        });
        await database.auditEvent.deleteMany({
          where: { actorId: { in: ids } },
        });
        await database.trustSnapshot.deleteMany({
          where: { userId: { in: ids } },
        });
        await database.userTrustState.deleteMany({
          where: { userId: { in: ids } },
        });
        await database.trustEvent.deleteMany({
          where: { userId: { in: ids } },
        });
        await database.userTrustReview.deleteMany({
          where: { targetId: { in: ids } },
        });
        const rules = await database.trustRuleVersion.findMany({
          where: { operatorId: owner.id },
          select: { id: true },
        });
        await database.trustPolicyState.deleteMany({
          where: { activeRuleId: { in: rules.map((rule) => rule.id) } },
        });
        await database.trustRuleVersion.deleteMany({
          where: { operatorId: owner.id },
        });
        await database.user.deleteMany({ where: { id: { in: ids } } });
      }
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
