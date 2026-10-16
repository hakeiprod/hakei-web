import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test } from "vitest";
import { submittedDraft, withCollaboration } from "./testing/collaboration";
import { mergeProposal } from "./merge-proposal";
import { setMember } from "./repositories";
import { adjustTrust, publishTrustRule } from "./trust";
import { recoverCollaborationPreparations } from "./collaboration-recovery";
import { recoverGitPublications } from "./git-publication";
const rule = {
  initialScore: 50,
  wAdmin: 2,
  wOutcome: 1,
  wReview: 1,
  acceptedDelta: 1,
  rejectedDelta: -1,
  reviewFactor: 1,
  minReview: -1,
  maxReview: 1,
  minScore: 0,
  maxScore: 100,
  mergeThreshold: 50,
};

test("two proposals sharing a base adopt exactly once", async () => {
  await withCollaboration(async (fixture) => {
    const first = await submittedDraft(fixture, fixture.editorId, "first", 62);
    const second = await submittedDraft(
      fixture,
      fixture.editorId,
      "second",
      64,
    );
    const shared = {
      actorId: fixture.ownerId,
      expectedRevisionId: fixture.revisionId,
      expectedRepositoryCommitOid: fixture.commitOid,
    };
    const outcomes = await Promise.allSettled([
      mergeProposal(fixture.database, fixture.git, {
        ...shared,
        proposalId: first.proposalId,
        expectedProposalVersion: first.version,
        key: "merge-first",
      }),
      mergeProposal(fixture.second, fixture.git, {
        ...shared,
        proposalId: second.proposalId,
        expectedProposalVersion: second.version,
        key: "merge-second",
      }),
    ]);
    expect(
      outcomes.filter((outcome) => outcome.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      await fixture.database.scoreRevision.count({
        where: { scoreId: fixture.scoreId },
      }),
    ).toBe(2);
    expect(
      await fixture.database.mergeRecord.count({
        where: { proposalId: { in: [first.proposalId, second.proposalId] } },
      }),
    ).toBe(1);
    expect(
      await fixture.database.trustEvent.count({
        where: { userId: fixture.editorId, type: "ACCEPTED" },
      }),
    ).toBe(1);
  });
});
test("revoking a grant after object preparation prevents adoption", async () => {
  await withCollaboration(async (fixture) => {
    const proposal = await submittedDraft(
      fixture,
      fixture.ownerId,
      "own-draft",
    );
    await expect(
      mergeProposal(
        fixture.database,
        fixture.git,
        {
          actorId: fixture.editorId,
          proposalId: proposal.proposalId,
          expectedProposalVersion: proposal.version,
          expectedRevisionId: fixture.revisionId,
          expectedRepositoryCommitOid: fixture.commitOid,
          key: "merge",
        },
        async (stage) => {
          if (stage === "OBJECT_RECORDED")
            await setMember(fixture.second, {
              actorId: fixture.ownerId,
              repositoryId: fixture.repositoryId,
              userId: fixture.editorId,
              role: "EDITOR",
              canMerge: false,
              expectedAccessVersion: 1,
            });
        },
      ),
    ).rejects.toThrow("FORBIDDEN");
    expect(
      await fixture.database.scoreRevision.count({
        where: { scoreId: fixture.scoreId },
      }),
    ).toBe(1);
    expect(
      await fixture.database.mergeRecord.count({
        where: { proposalId: proposal.proposalId },
      }),
    ).toBe(0);
  });
});
test("ALL_USERS requires configured trust, includes exact threshold and offers no owner bypass", async () => {
  await withCollaboration(async (fixture) => {
    const proposal = await submittedDraft(fixture, fixture.ownerId, "self");
    const input = {
      actorId: fixture.ownerId,
      proposalId: proposal.proposalId,
      expectedProposalVersion: proposal.version,
      expectedRevisionId: fixture.revisionId,
      expectedRepositoryCommitOid: fixture.commitOid,
      key: "merge",
    };
    await expect(
      mergeProposal(fixture.database, fixture.git, input),
    ).rejects.toThrow("TRUST_UNCONFIGURED");
    const policy = (await publishTrustRule(fixture.database, {
      actorId: fixture.ownerId,
      rule: { ...rule, initialScore: 49 },
      expectedPolicyVersion: 0,
      reason: "Threshold test",
      key: "policy",
    })) as { ruleId: string };
    await expect(
      mergeProposal(fixture.database, fixture.git, input),
    ).rejects.toThrow("INSUFFICIENT_TRUST");
    await adjustTrust(fixture.database, {
      actorId: fixture.ownerId,
      targetId: fixture.ownerId,
      desiredScore: 50,
      expectedRuleId: policy.ruleId,
      reason: "Verified trust",
      key: "adjust",
    });
    await mergeProposal(fixture.database, fixture.git, input);
    expect(
      await fixture.database.trustEvent.count({
        where: { userId: fixture.ownerId, type: "ACCEPTED" },
      }),
    ).toBe(0);
    expect(
      await fixture.database.mergeRecord.findUnique({
        where: { proposalId: proposal.proposalId },
      }),
    ).toMatchObject({
      authorizationKind: "GLOBAL_TRUST",
      trustScore: 50,
      threshold: 50,
    });
  }, true);
});
test("rule changed after preparation is rechecked during adoption", async () => {
  await withCollaboration(async (fixture) => {
    await publishTrustRule(fixture.database, {
      actorId: fixture.ownerId,
      rule,
      expectedPolicyVersion: 0,
      reason: "Initial rule",
      key: "initial-policy",
    });
    const proposal = await submittedDraft(fixture, fixture.editorId, "edit");
    await expect(
      mergeProposal(
        fixture.database,
        fixture.git,
        {
          actorId: fixture.ownerId,
          proposalId: proposal.proposalId,
          expectedProposalVersion: proposal.version,
          expectedRevisionId: fixture.revisionId,
          expectedRepositoryCommitOid: fixture.commitOid,
          key: "merge",
        },
        async (stage) => {
          if (stage === "OBJECT_RECORDED")
            await publishTrustRule(fixture.second, {
              actorId: fixture.ownerId,
              rule: { ...rule, initialScore: 0 },
              expectedPolicyVersion: 1,
              reason: "Policy changed",
              key: "changed-policy",
            });
        },
      ),
    ).rejects.toThrow("INSUFFICIENT_TRUST");
    expect(
      await fixture.database.scoreRevision.count({
        where: { scoreId: fixture.scoreId },
      }),
    ).toBe(1);
    expect(
      await fixture.database.trustEvent.count({
        where: { userId: fixture.editorId, type: "ACCEPTED" },
      }),
    ).toBe(0);
  }, true);
});
for (const stage of ["REF_PREPARED", "DB_APPLIED", "REF_PUBLISHED"]) {
  test(`process termination after ${stage} recovers once without original request data`, async () => {
    await withCollaboration(async (fixture) => {
      const proposal = await submittedDraft(fixture, fixture.editorId, "edit");
      const input = {
        actorId: fixture.ownerId,
        proposalId: proposal.proposalId,
        expectedProposalVersion: proposal.version,
        expectedRevisionId: fixture.revisionId,
        expectedRepositoryCommitOid: fixture.commitOid,
        key: "merge",
      };
      await expect(
        promisify(execFile)(
          process.execPath,
          [
            "--conditions=react-server",
            "--import",
            "tsx",
            "src/server/testing/merge-worker.ts",
            fixture.root,
            JSON.stringify(input),
            stage,
          ],
          {
            env: {
              ...process.env,
              DATABASE_URL: process.env.TEST_DATABASE_URL,
            },
            timeout: 10_000,
          },
        ),
      ).rejects.toMatchObject({ code: 97 });
      await fixture.second.mutationReceipt.updateMany({
        where: { actorId: fixture.ownerId, operation: "MERGE_PROPOSAL" },
        data: { leaseUntil: new Date(0) },
      });
      const preparations = await recoverCollaborationPreparations(
        fixture.second,
        fixture.git,
      );
      expect(
        preparations.every((result) => result.status === "RECOVERED"),
      ).toBe(true);
      const publications = await recoverGitPublications(
        fixture.second,
        fixture.git,
      );
      expect(publications.every((result) => !result.error)).toBe(true);
      expect(
        await fixture.second.mergeRecord.count({
          where: { proposalId: proposal.proposalId },
        }),
      ).toBe(1);
      expect(
        await fixture.second.trustEvent.count({
          where: { userId: fixture.editorId, type: "ACCEPTED" },
        }),
      ).toBe(1);
      expect(
        await fixture.second.scoreRevision.count({
          where: { scoreId: fixture.scoreId },
        }),
      ).toBe(2);
      expect(
        await fixture.second.scoreRepository.findUnique({
          where: { id: fixture.repositoryId },
        }),
      ).toMatchObject({ syncState: "READY", acceptedGeneration: 2 });
    });
  });
}
