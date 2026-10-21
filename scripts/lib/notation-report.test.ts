// @vitest-environment node
import { expect, test } from "vitest";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  rendererRevision,
  atomicReport,
  fixtureIdentity,
} from "./notation-report";
test("fingerprints current uncommitted source/font changes and writes a complete report", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "notation-report-"));
  try {
    await mkdir(path.join(root, "src/s-core/const/bravura"), {
      recursive: true,
    });
    await writeFile(path.join(root, "src/s-core/const/bravura/font"), "first");
    const first = await rendererRevision(root);
    await writeFile(path.join(root, "src/s-core/const/bravura/font"), "second");
    expect(await rendererRevision(root)).not.toBe(first);
    await atomicReport(path.join(root, "result.json"), {
      version: 1,
      runs: [],
    });
    expect(
      JSON.parse(await readFile(path.join(root, "result.json"), "utf8")),
    ).toEqual({ version: 1, runs: [] });
    expect(
      fixtureIdentity(new Uint8Array([1]), { assertions: [] }, first)
        .sourceHash,
    ).toHaveLength(64);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects fixture paths outside the root, including symlinks", async () => {
  const { readFixture } = await import("./notation-report");
  const { symlink } = await import("node:fs/promises");
  const root = await mkdtemp(path.join(tmpdir(), "notation-path-"));
  try {
    await mkdir(path.join(root, "fixtures"));
    await writeFile(path.join(root, "secret"), "private");
    await symlink(
      path.join(root, "secret"),
      path.join(root, "fixtures", "escape"),
    );
    await expect(
      readFixture("../secret", path.join(root, "fixtures")),
    ).rejects.toThrow("escapes root");
    await expect(
      readFixture("escape", path.join(root, "fixtures")),
    ).rejects.toThrow("escapes root");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("allowlists suites and keeps the old default report separate", async () => {
  const { fixtureSuite } = await import("./notation-report");
  expect(fixtureSuite().name).toBe("notation");
  expect(fixtureSuite("tab-drum").reportDirectory).not.toBe(
    fixtureSuite().reportDirectory,
  );
  expect(() => fixtureSuite("../../secret")).toThrow("Unknown fixture suite");
});
