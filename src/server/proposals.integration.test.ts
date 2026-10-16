import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import * as Core from "@/s-core/models/core";
import "@/s-core/models/core/extensions/to-sheet";
import { withTestConnections } from "./testing/database";
import { GitStore } from "./git-store";
import { createRepository, setMember } from "./repositories";
import { createScore } from "./score-creation";
import { saveDraft, submitProposal } from "./proposals";
import { mergeProposal } from "./merge-proposal";
import { readScore } from "./score-reader";

function candidate(pitch: number) {
  // Simulate the Git/HTTP JSON boundary rather than live value objects.
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
test("draft updates are private to author, submitted commits freeze, merges count once and stale proposals conflict", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hakei-proposal-"));
  try {
    await withTestConnections(async (database, second) => {
      const owner = await database.user.create({ data: {} });
      const editor = await database.user.create({ data: {} });
      let repositoryId: string | undefined, scoreId: number | undefined;
      const git = new GitStore(root);
      try {
        const repository = (await createRepository(database, {
          actorId: owner.id,
          name: "Music",
          visibility: "PUBLIC",
          editScope: "INVITED",
          key: "repo",
        })) as { repositoryId: string };
        repositoryId = repository.repositoryId;
        await setMember(database, {
          actorId: owner.id,
          repositoryId,
          userId: editor.id,
          role: "EDITOR",
          canMerge: false,
          expectedAccessVersion: 0,
        });
        const newScore = {
          actorId: owner.id,
          repositoryId,
          candidate: candidate(60),
          key: "score",
        };
        const initial = (await createScore(database, git, newScore)) as {
          scoreId: number;
          revisionId: string;
          commitOid: string;
        };
        scoreId = initial.scoreId;
        expect(await createScore(second, git, newScore)).toEqual(initial);
        expect(
          await database.score.findUnique({ where: { id: scoreId } }),
        ).toMatchObject({ data: null });
        const draft = (await saveDraft(database, git, {
          actorId: editor.id,
          scoreId,
          baseRevisionId: initial.revisionId,
          candidate: candidate(62),
          summary: "Fix note",
          key: "draft",
        })) as { proposalId: string; version: number };
        const stale = (await saveDraft(database, git, {
          actorId: editor.id,
          scoreId,
          baseRevisionId: initial.revisionId,
          candidate: candidate(67),
          summary: "Other note",
          key: "stale",
        })) as { proposalId: string; version: number };
        await submitProposal(database, {
          actorId: editor.id,
          proposalId: stale.proposalId,
          expectedVersion: 0,
        });
        await expect(
          saveDraft(database, git, {
            actorId: owner.id,
            scoreId,
            baseRevisionId: initial.revisionId,
            candidate: candidate(63),
            summary: "Cannot edit someone else's draft",
            key: "not-author",
            proposalId: draft.proposalId,
            expectedVersion: 0,
          }),
        ).rejects.toThrow("FORBIDDEN");
        await saveDraft(database, git, {
          actorId: editor.id,
          scoreId,
          baseRevisionId: initial.revisionId,
          candidate: candidate(64),
          summary: "Correct pitch",
          key: "update",
          proposalId: draft.proposalId,
          expectedVersion: 0,
        });
        const submitted = await submitProposal(database, {
          actorId: editor.id,
          proposalId: draft.proposalId,
          expectedVersion: 1,
        });
        await expect(
          saveDraft(database, git, {
            actorId: editor.id,
            scoreId,
            baseRevisionId: initial.revisionId,
            candidate: candidate(65),
            summary: "Cannot alter submitted content",
            key: "frozen",
            proposalId: draft.proposalId,
            expectedVersion: 2,
          }),
        ).rejects.toThrow("CONFLICT");
        const before = await readScore(second, git, scoreId);
        expect(before.revisionId).toBe(initial.revisionId);
        const merge = {
          actorId: owner.id,
          proposalId: draft.proposalId,
          expectedProposalVersion: submitted.version,
          expectedRevisionId: initial.revisionId,
          expectedRepositoryCommitOid: initial.commitOid,
          key: "merge",
        };
        const result = await mergeProposal(database, git, merge);
        expect(await mergeProposal(second, git, merge)).toEqual(result);
        expect(
          await database.trustEvent.count({
            where: { userId: editor.id, type: "ACCEPTED" },
          }),
        ).toBe(1);
        expect(
          await database.userTrustState.findUnique({
            where: { userId: editor.id },
          }),
        ).toMatchObject({ inputVersion: 1 });
        expect(
          await database.mergeRecord.count({
            where: { proposalId: draft.proposalId },
          }),
        ).toBe(1);
        await expect(
          mergeProposal(second, git, {
            ...merge,
            proposalId: stale.proposalId,
            expectedProposalVersion: 1,
            key: "stale-merge",
          }),
        ).rejects.toThrow("CONFLICT");
        expect(
          await database.editProposal.findUnique({
            where: { id: stale.proposalId },
          }),
        ).toMatchObject({ status: "CONFLICTED" });
        expect(await database.scoreRevision.count({ where: { scoreId } })).toBe(
          2,
        );
        expect(
          await database.trustEvent.count({
            where: { userId: editor.id, type: "ACCEPTED" },
          }),
        ).toBe(1);
      } finally {
        if (repositoryId) {
          const proposals = await database.editProposal.findMany({
            where: { scoreId },
            select: { id: true },
          });
          await database.mergeRecord.deleteMany({
            where: {
              proposalId: { in: proposals.map((proposal) => proposal.id) },
            },
          });
          await database.editProposal.deleteMany({ where: { scoreId } });
          await database.gitPublicationJob.deleteMany({
            where: { repositoryId },
          });
          await database.mutationReceipt.deleteMany({
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
        await database.auditEvent.deleteMany({
          where: { actorId: { in: [owner.id, editor.id] } },
        });
        await database.trustEvent.deleteMany({
          where: { userId: { in: [owner.id, editor.id] } },
        });
        await database.userTrustState.deleteMany({
          where: { userId: { in: [owner.id, editor.id] } },
        });
        await database.user.deleteMany({
          where: { id: { in: [owner.id, editor.id] } },
        });
      }
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
