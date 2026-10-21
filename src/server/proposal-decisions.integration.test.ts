import { expect, test } from "vitest";
import { submittedDraft, withCollaboration } from "./testing/collaboration";
import { closeProposal } from "./proposals";
import { archiveScore } from "./score-archive";
import { readScore } from "./score-reader";
test("reject/withdraw decisions are authorized and rejected trust outcomes are counted once", async () => {
  await withCollaboration(async (fixture) => {
    const draft = await submittedDraft(fixture, fixture.editorId, "reject");
    const rejection = {
      actorId: fixture.ownerId,
      proposalId: draft.proposalId,
      expectedVersion: draft.version,
      decision: "REJECTED" as const,
      reason: "Incorrect pitch",
      key: "reject",
    };
    const result = await closeProposal(fixture.database, rejection);
    expect(await closeProposal(fixture.second, rejection)).toEqual(result);
    expect(
      await fixture.database.trustEvent.count({
        where: { sourceId: draft.proposalId, type: "REJECTED" },
      }),
    ).toBe(1);
    const self = await submittedDraft(fixture, fixture.ownerId, "self-reject");
    await closeProposal(fixture.database, {
      ...rejection,
      proposalId: self.proposalId,
      expectedVersion: self.version,
      reason: "Own correction not needed",
      key: "self-reject",
    });
    expect(
      await fixture.database.trustEvent.count({
        where: { sourceId: self.proposalId },
      }),
    ).toBe(0);
    const withdraw = await submittedDraft(
      fixture,
      fixture.editorId,
      "withdraw",
    );
    await expect(
      closeProposal(fixture.database, {
        actorId: fixture.ownerId,
        proposalId: withdraw.proposalId,
        expectedVersion: withdraw.version,
        decision: "WITHDRAWN",
        reason: "Not author",
        key: "not-author",
      }),
    ).rejects.toThrow("FORBIDDEN");
    await closeProposal(fixture.database, {
      actorId: fixture.editorId,
      proposalId: withdraw.proposalId,
      expectedVersion: withdraw.version,
      decision: "WITHDRAWN",
      reason: "Rework later",
      key: "withdraw",
    });
    expect(
      await fixture.database.trustEvent.count({
        where: { sourceId: withdraw.proposalId },
      }),
    ).toBe(0);
  });
});
test("archive requires administrator access and retains Git history and revision indices", async () => {
  await withCollaboration(async (fixture) => {
    const input = {
      actorId: fixture.editorId,
      scoreId: fixture.scoreId,
      expectedRevisionId: fixture.revisionId,
      key: "archive",
    };
    await expect(archiveScore(fixture.database, input)).rejects.toThrow(
      "FORBIDDEN",
    );
    const result = await archiveScore(fixture.database, {
      ...input,
      actorId: fixture.ownerId,
    });
    expect(
      await archiveScore(fixture.second, {
        ...input,
        actorId: fixture.ownerId,
      }),
    ).toEqual(result);
    expect(
      await fixture.database.scoreRevision.count({
        where: { scoreId: fixture.scoreId },
      }),
    ).toBe(1);
    await expect(
      readScore(
        fixture.database,
        fixture.git,
        fixture.scoreId,
        fixture.ownerId,
      ),
    ).rejects.toThrow("NOT_FOUND");
    const repository = await fixture.database.scoreRepository.findUniqueOrThrow(
      { where: { id: fixture.repositoryId } },
    );
    expect(
      await fixture.git.readRef(repository.gitStorageKey, "refs/heads/main"),
    ).toBe(fixture.commitOid);
  });
});
