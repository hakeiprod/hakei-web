// @vitest-environment node
import { expect, test, vi } from "vitest";
import { payloadHash } from "./contracts";
import { readScore } from "./score-reader";
import type { ReaderDatabase } from "./score-reader";
import type { GitStore } from "./git-store";
function setup(visibility = "PUBLIC", managed = true) {
  const database = {
    score: {
      findUnique: vi.fn().mockResolvedValue({
        id: 1,
        repositoryId: managed ? "repo" : null,
        currentRevisionId: "revision",
      }),
    },
    scoreRepository: {
      findUnique: vi.fn().mockResolvedValue({
        id: "repo",
        gitStorageKey: "repo_1",
        ownerId: "owner",
        visibility,
      }),
    },
    repositoryMember: { findUnique: vi.fn().mockResolvedValue(null) },
    scoreRevision: {
      findFirst: vi.fn().mockResolvedValue({
        id: "revision",
        scoreId: 1,
        repositoryId: "repo",
        commitOid: "a".repeat(40),
        path: "scores/1/score.json",
        number: 1,
        dataHash: payloadHash({ notes: [] }),
      }),
    },
  };
  const git = {
    hasScoreFile: vi.fn().mockResolvedValue(false),
    readJson: vi.fn().mockResolvedValue({ notes: [] }),
  };
  return {
    database: database as unknown as ReaderDatabase,
    git: git as unknown as GitStore,
    read: git.readJson,
    revision: database.scoreRevision.findFirst,
  };
}
test("unauthorized and unmanaged scores never read Git", async () => {
  for (const [visibility, managed] of [
    ["PRIVATE", true],
    ["PUBLIC", false],
  ] as const) {
    const fixture = setup(visibility, managed);
    await expect(readScore(fixture.database, fixture.git, 1)).rejects.toThrow(
      "NOT_FOUND",
    );
    expect(fixture.read).not.toHaveBeenCalled();
  }
});
test("only a revision indexed to this score and repository can be read", async () => {
  const fixture = setup();
  await readScore(fixture.database, fixture.git, 1, undefined, "past-revision");
  expect(fixture.revision).toHaveBeenCalledWith({
    where: { id: "past-revision", scoreId: 1, repositoryId: "repo" },
  });
  expect(fixture.read).toHaveBeenCalledWith(
    "repo_1",
    "a".repeat(40),
    "scores/1/score.json",
  );
  fixture.revision.mockResolvedValueOnce(null);
  await expect(
    readScore(fixture.database, fixture.git, 1, undefined, "arbitrary-oid"),
  ).rejects.toThrow("NOT_FOUND");
});
