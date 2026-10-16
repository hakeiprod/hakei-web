import { expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { withCollaboration } from "./testing/collaboration";
import { convertScore } from "@/s-core/models/import/convert";
import { signPreview } from "./import-preview-token";
import { beginPractice, savePractice } from "./practice";
import { saveImport } from "./score-import";
const secret = "test-secret-at-least-32-characters-long";
it("saves a warned candidate once, keeps blockers and stores no original bytes", async () =>
  withCollaboration(async (fixture) => {
    const result = await convertScore({
      bytes: await readFile("src/s-core/fixtures/import/repeat.musicxml"),
      sourceName: "repeat.musicxml",
      options: { mode: "PRESERVE" },
    });
    const payload = {
      candidate: result.candidate,
      issues: result.issues,
      metadata: result.metadata,
    };
    const input = {
      ...payload,
      previewToken: signPreview(fixture.ownerId, payload, secret),
      repositoryId: fixture.repositoryId,
      acknowledgedIssueIds: result.issues
        .filter(
          (issue) => issue.severity !== "INFO" && issue.status === "UNRESOLVED",
        )
        .map((issue) => issue.id),
      key: "import-repeat",
    };
    const saved = (await saveImport(
      fixture.database,
      fixture.git,
      fixture.ownerId,
      input,
      secret,
    )) as { scoreId: number; revisionId: string; commitOid: string };
    expect(
      await saveImport(
        fixture.database,
        fixture.git,
        fixture.ownerId,
        input,
        secret,
      ),
    ).toEqual(saved);
    expect(
      await fixture.database.scoreRevision.count({
        where: { scoreId: saved.scoreId },
      }),
    ).toBe(1);
    expect(
      await fixture.database.revisionValidation.findUnique({
        where: { revisionId: saved.revisionId },
      }),
    ).toMatchObject({ canPractice: false, canGame: false });
    const repo = await fixture.database.scoreRepository.findUniqueOrThrow({
      where: { id: fixture.repositoryId },
    });
    const settings = await fixture.git.readJson(
      repo.gitStorageKey,
      saved.commitOid,
      `scores/${saved.scoreId}/settings.json`,
    );
    expect(JSON.stringify(settings)).not.toContain("bytes");
    expect(settings).toMatchObject({ metadata: result.metadata });
  }));
it("rejects missing warning confirmation and another actor's token before creating a score", async () =>
  withCollaboration(async (fixture) => {
    const result = await convertScore({
      bytes: await readFile("src/s-core/fixtures/import/repeat.musicxml"),
      sourceName: "repeat.musicxml",
      options: { mode: "PRESERVE" },
    });
    const input = {
      candidate: result.candidate,
      issues: result.issues,
      metadata: result.metadata,
      previewToken: signPreview(fixture.ownerId, result, secret),
      repositoryId: fixture.repositoryId,
      acknowledgedIssueIds: [],
      key: "invalid-import",
    };
    await expect(
      saveImport(fixture.database, fixture.git, fixture.ownerId, input, secret),
    ).rejects.toThrow("WARNING_ACKNOWLEDGEMENT_REQUIRED");
    await expect(
      saveImport(
        fixture.database,
        fixture.git,
        fixture.editorId,
        input,
        secret,
      ),
    ).rejects.toThrow("INVALID_PREVIEW_TOKEN");
    expect(
      await fixture.database.score.count({
        where: { repositoryId: fixture.repositoryId },
      }),
    ).toBe(1);
  }));
it("existing imports create proposals and preserve blockers through merge and later manual edits", async () =>
  withCollaboration(async (fixture) => {
    const { mergeProposal } = await import("./merge-proposal");
    const { saveDraft } = await import("./proposals");
    const result = await convertScore({
      bytes: await readFile("src/s-core/fixtures/import/repeat.musicxml"),
      sourceName: "repeat.musicxml",
      options: { mode: "PRESERVE" },
    });
    const input = {
      candidate: result.candidate,
      issues: result.issues,
      metadata: result.metadata,
      previewToken: signPreview(fixture.editorId, result, secret),
      repositoryId: fixture.repositoryId,
      scoreId: fixture.scoreId,
      baseRevisionId: fixture.revisionId,
      acknowledgedIssueIds: result.issues
        .filter(
          (issue) => issue.severity !== "INFO" && issue.status === "UNRESOLVED",
        )
        .map((issue) => issue.id),
      key: "replace-import",
    };
    const draft = (await saveImport(
      fixture.database,
      fixture.git,
      fixture.editorId,
      input,
      secret,
    )) as { proposalId: string; version: number };
    expect(
      await fixture.database.score.findUnique({
        where: { id: fixture.scoreId },
      }),
    ).toMatchObject({ currentRevisionId: fixture.revisionId });
    const merged = (await mergeProposal(fixture.database, fixture.git, {
      actorId: fixture.ownerId,
      proposalId: draft.proposalId,
      expectedProposalVersion: draft.version,
      expectedRevisionId: fixture.revisionId,
      expectedRepositoryCommitOid: fixture.commitOid,
      key: "merge-import",
    })) as { revisionId: string };
    expect(
      await fixture.database.revisionValidation.findUnique({
        where: { revisionId: merged.revisionId },
      }),
    ).toMatchObject({ canPractice: false });
    const manual = (await saveDraft(fixture.database, fixture.git, {
      actorId: fixture.editorId,
      scoreId: fixture.scoreId,
      baseRevisionId: merged.revisionId,
      candidate: result.candidate,
      summary: "Check unchanged music",
      key: "manual-import-followup",
    })) as { proposalId: string };
    const proposal = await fixture.database.editProposal.findUniqueOrThrow({
      where: { id: manual.proposalId },
    });
    const repository = await fixture.database.scoreRepository.findUniqueOrThrow(
      { where: { id: fixture.repositoryId } },
    );
    expect(
      await fixture.git.readJson(
        repository.gitStorageKey,
        proposal.proposalCommitOid,
        `scores/${fixture.scoreId}/validation.json`,
      ),
    ).toMatchObject({ canPractice: false });
  }));
it("rejects expiry and revoked editing permission without adoption", async () =>
  withCollaboration(async (fixture) => {
    const { setMember } = await import("./repositories");
    const result = await convertScore({
      bytes: await readFile("src/s-core/fixtures/import/quarter.musicxml"),
      sourceName: "quarter.musicxml",
      options: { mode: "PRESERVE" },
    });
    const input = {
      candidate: result.candidate,
      issues: result.issues,
      metadata: result.metadata,
      previewToken: signPreview(fixture.editorId, result, secret),
      repositoryId: fixture.repositoryId,
      acknowledgedIssueIds: [],
      key: "revoke-import",
    };
    const expired = {
      ...input,
      previewToken: signPreview(fixture.editorId, result, secret, 1000),
    };
    await expect(
      saveImport(
        fixture.database,
        fixture.git,
        fixture.editorId,
        expired,
        secret,
      ),
    ).rejects.toThrow("PREVIEW_EXPIRED");
    await setMember(fixture.database, {
      actorId: fixture.ownerId,
      repositoryId: fixture.repositoryId,
      userId: fixture.editorId,
      role: "REMOVE",
      canMerge: false,
      expectedAccessVersion: 1,
    });
    await expect(
      saveImport(
        fixture.database,
        fixture.git,
        fixture.editorId,
        input,
        secret,
      ),
    ).rejects.toThrow("FORBIDDEN");
    expect(
      await fixture.database.score.count({
        where: { repositoryId: fixture.repositoryId },
      }),
    ).toBe(1);
  }));
it("blocks session access to the original partial revision and allows only its corrected adopted revision", async () =>
  withCollaboration(async (fixture) => {
    const { requirePlayableRevision } = await import("./practice-access");
    const { saveDraft, submitProposal } = await import("./proposals");
    const { mergeProposal } = await import("./merge-proposal");
    const result = await convertScore({
      bytes: await readFile(
        "src/s-core/fixtures/import/missing-duration.musicxml",
      ),
      sourceName: "missing.musicxml",
      options: { mode: "PRESERVE" },
    });
    const input = {
      candidate: result.candidate,
      issues: result.issues,
      metadata: result.metadata,
      previewToken: signPreview(fixture.ownerId, result, secret),
      repositoryId: fixture.repositoryId,
      acknowledgedIssueIds: result.issues
        .filter(
          (issue) => issue.severity !== "INFO" && issue.status === "UNRESOLVED",
        )
        .map((issue) => issue.id),
      key: "partial-save",
    };
    const saved = (await saveImport(
      fixture.database,
      fixture.git,
      fixture.ownerId,
      input,
      secret,
    )) as { scoreId: number; revisionId: string; commitOid: string };
    await expect(
      requirePlayableRevision(
        fixture.database,
        fixture.git,
        saved.scoreId,
        fixture.ownerId,
        saved.revisionId,
        "PRACTICE",
      ),
    ).rejects.toThrow("PLAYBACK_BLOCKED");
    const blockedIdentity = {
      clientSessionId: "blocked-import",
      scoreId: saved.scoreId,
      scoreRevisionId: saved.revisionId,
      conditions: {
        trackId: 0,
        rangeStartBar: 1,
        rangeEndBar: 1,
        tempoScale: 1,
        calibrationUs: 0,
        mode: "PRACTICE",
        ruleVersion: 1,
      },
    };
    await expect(
      beginPractice(
        fixture.database,
        fixture.git,
        fixture.ownerId,
        blockedIdentity,
      ),
    ).rejects.toThrow("PLAYBACK_BLOCKED");
    await expect(
      savePractice(fixture.database, fixture.git, fixture.ownerId, {
        ...blockedIdentity,
        status: "COMPLETED",
        endedUs: 2_150_000,
        eventBatches: [],
      }),
    ).rejects.toThrow("PLAYBACK_BLOCKED");
    await expect(
      beginPractice(fixture.database, fixture.git, fixture.ownerId, {
        ...blockedIdentity,
        conditions: { ...blockedIdentity.conditions, mode: "GAME" },
      }),
    ).rejects.toThrow("PLAYBACK_BLOCKED");
    await expect(
      savePractice(fixture.database, fixture.git, fixture.ownerId, {
        ...blockedIdentity,
        conditions: { ...blockedIdentity.conditions, mode: "GAME" },
        status: "COMPLETED",
        endedUs: 2_150_000,
        eventBatches: [],
      }),
    ).rejects.toThrow("PLAYBACK_BLOCKED");
    const candidate = structuredClone(result.candidate);
    candidate.notes[0].duration = 1;
    const draft = (await saveDraft(fixture.database, fixture.git, {
      actorId: fixture.ownerId,
      scoreId: saved.scoreId,
      baseRevisionId: saved.revisionId,
      candidate,
      summary: "Correct missing duration",
      key: "partial-correction",
    })) as { proposalId: string; version: number };
    const submitted = await submitProposal(fixture.database, {
      actorId: fixture.ownerId,
      proposalId: draft.proposalId,
      expectedVersion: draft.version,
    });
    const merged = (await mergeProposal(fixture.database, fixture.git, {
      actorId: fixture.ownerId,
      proposalId: draft.proposalId,
      expectedProposalVersion: submitted.version,
      expectedRevisionId: saved.revisionId,
      expectedRepositoryCommitOid: saved.commitOid,
      key: "merge-partial",
    })) as { revisionId: string };
    const playable = await requirePlayableRevision(
      fixture.database,
      fixture.git,
      saved.scoreId,
      fixture.ownerId,
      merged.revisionId,
      "PRACTICE",
    );
    expect(playable.artifacts?.validation.canPractice).toBe(true);
    await expect(
      requirePlayableRevision(
        fixture.database,
        fixture.git,
        saved.scoreId,
        fixture.ownerId,
        saved.revisionId,
        "GAME",
      ),
    ).rejects.toThrow("PLAYBACK_BLOCKED");
  }));
