// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, test } from "vitest";
import { GitStore } from "./git-store";
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
test("immutable commits preserve old score and compare-and-swap refs reject a stale writer", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hakei-git-"));
  roots.push(root);
  const store = new GitStore(root);
  await store.initialize("repo_1");
  const first = await store.commit(
    "repo_1",
    undefined,
    { "scores/1/score.json": { pitch: 60 } },
    "initial",
  );
  await store.updateRef("repo_1", "refs/heads/main", first);
  const second = await store.commit(
    "repo_1",
    first,
    { "scores/1/score.json": { pitch: 62 } },
    "edit",
  );
  await store.updateRef("repo_1", "refs/heads/main", second, first);
  expect(await store.readJson("repo_1", first, "scores/1/score.json")).toEqual({
    pitch: 60,
  });
  expect(await store.readJson("repo_1", second, "scores/1/score.json")).toEqual(
    { pitch: 62 },
  );
  await expect(
    store.updateRef("repo_1", "refs/heads/main", first, first),
  ).rejects.toThrow();
});
test("rejects traversal, option injection and arbitrary paths before spawning Git", async () => {
  const store = new GitStore(tmpdir());
  await expect(store.initialize("../repo")).rejects.toThrow();
  await expect(store.readJson("safe", "--help", "../secret")).rejects.toThrow();
});
