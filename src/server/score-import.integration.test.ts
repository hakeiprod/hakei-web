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

it(
  "persists source versions and independent musical values through DB, Git, readback and proposals",
  async () =>
    withCollaboration(async (fixture) => {
      const { readScore } = await import("./score-reader");
      const { readRevisionArtifacts } = await import("./revision-validation");
      const legacy = await readScore(
        fixture.database,
        fixture.git,
        fixture.scoreId,
        fixture.ownerId,
      );
      expect(legacy.id).toBe(fixture.scoreId);
      for (const version of ["2.0", "3.0", "3.1", "4.0"]) {
        for (const extension of ["musicxml", "mxl"]) {
          const result = await convertScore({
            bytes: await readFile(
              `src/s-core/fixtures/import/musicxml-versions/study-${version}.${extension}`,
            ),
            sourceName: `study-${version}.${extension}`,
            options: { mode: "PRESERVE" },
          });
          const input = {
            candidate: result.candidate,
            issues: result.issues,
            metadata: result.metadata,
            repositoryId: fixture.repositoryId,
            previewToken: signPreview(fixture.ownerId, result, secret),
            acknowledgedIssueIds: result.issues
              .filter(
                (index) =>
                  index.severity !== "INFO" && index.status === "UNRESOLVED",
              )
              .map((index) => index.id),
            key: `version-${version.replaceAll(".", "-")}-${extension}`,
          };
          const saved = (await saveImport(
            fixture.database,
            fixture.git,
            fixture.ownerId,
            input,
            secret,
          )) as { scoreId: number; revisionId: string; commitOid: string };
          const dto = await readScore(
            fixture.database,
            fixture.git,
            saved.scoreId,
            fixture.ownerId,
          );
          expect(dto.data).toEqual(result.candidate);
          expect(dto.artifacts?.metadata).toEqual(result.metadata);
          expect(dto.artifacts?.validation.canPractice).toBe(true);
          expect(
            await fixture.database.importMetadata.findUnique({
              where: { revisionId: saved.revisionId },
            }),
          ).toMatchObject({ formatVersion: version });
          const repository =
            await fixture.database.scoreRepository.findUniqueOrThrow({
              where: { id: fixture.repositoryId },
            });
          expect(
            await fixture.git.readJson(
              repository.gitStorageKey,
              saved.commitOid,
              `scores/${saved.scoreId}/settings.json`,
            ),
          ).toMatchObject({ metadata: { formatVersion: version } });
          if (version === "3.1" && extension === "mxl") {
            const { saveDraft, submitProposal } = await import("./proposals");
            const { mergeProposal } = await import("./merge-proposal");
            const draft = (await saveDraft(fixture.database, fixture.git, {
              actorId: fixture.ownerId,
              scoreId: saved.scoreId,
              baseRevisionId: saved.revisionId,
              candidate: result.candidate,
              summary: "Version retention",
              key: "version-retention-draft",
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
              key: "version-retention-merge",
            })) as { revisionId: string };
            const read = await readScore(
              fixture.database,
              fixture.git,
              saved.scoreId,
              fixture.ownerId,
              merged.revisionId,
            );
            expect(read.artifacts?.metadata?.formatVersion).toBe(version);
            expect(read.data).toEqual(result.candidate);
          }
          const old = {
            ...result.metadata,
            converterVersion: "score-import-v1",
          };
          if (version === "2.0" && extension === "musicxml") {
            const { revisionArtifacts, artifactFiles } =
              await import("./revision-validation");
            for (const metadata of [old, null]) {
              const artifacts = revisionArtifacts(
                result.candidate,
                metadata,
                result.issues,
              );
              const legacyOid = await fixture.git.commit(
                repository.gitStorageKey,
                undefined,
                {
                  [`scores/${saved.scoreId}/score.json`]: result.candidate,
                  ...artifactFiles(saved.scoreId, artifacts),
                },
                "Legacy import metadata fixture",
              );
              const restored = await readRevisionArtifacts(
                fixture.git,
                repository.gitStorageKey,
                legacyOid,
                saved.scoreId,
              );
              expect(restored?.metadata).toEqual(metadata);
            }
            const bareOid = await fixture.git.commit(
              repository.gitStorageKey,
              undefined,
              { [`scores/${saved.scoreId}/score.json`]: result.candidate },
              "Legacy score without artifacts",
            );
            expect(
              await readRevisionArtifacts(
                fixture.git,
                repository.gitStorageKey,
                bareOid,
                saved.scoreId,
              ),
            ).toBeUndefined();
          }

          const { revisionArtifacts, artifactFiles } =
            await import("./revision-validation");
          const files = artifactFiles(
            saved.scoreId,
            revisionArtifacts(result.candidate, old, result.issues),
          );
          expect(files[`scores/${saved.scoreId}/settings.json`]).toMatchObject({
            metadata: old,
          });
          expect(
            await readRevisionArtifacts(
              fixture.git,
              repository.gitStorageKey,
              saved.commitOid,
              saved.scoreId,
            ),
          ).toMatchObject({ metadata: result.metadata });
        }
      }
    }),
  20_000,
);
