import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { withTestConnections } from "./testing/database";
import {
  acquireImportLease,
  releaseImportLease,
  runImportWorker,
} from "./import-worker";
it("uses a real built worker and retains no upload bytes in its result", async () => {
  const bytes = await readFile("src/s-core/fixtures/import/quarter.musicxml");
  const result = await runImportWorker({
    bytes,
    sourceName: "quarter.musicxml",
    options: { mode: "PRESERVE" },
  });
  expect(result.validation.canPractice).toBe(true);
  expect(result).not.toHaveProperty("bytes");
  expect(bytes[0]).toBe(60);
});
it("cancels a worker and rejects oversize input before starting", async () => {
  const bytes = await readFile("src/s-core/fixtures/import/quarter.musicxml");
  const abort = new AbortController();
  abort.abort();
  await expect(
    runImportWorker(
      { bytes, sourceName: "quarter.musicxml", options: { mode: "PRESERVE" } },
      abort.signal,
    ),
  ).rejects.toThrow("IMPORT_ABORTED");
  await expect(
    runImportWorker({
      bytes: new Uint8Array(5 * 1024 * 1024 + 1),
      sourceName: "large.mid",
      options: { mode: "PRESERVE" },
    }),
  ).rejects.toThrow("INPUT_LIMIT");
});
it("two pools admit one request and stale owners cannot release its replacement", async () =>
  withTestConnections(async (first, second) => {
    const actor = `import-${crypto.randomUUID()}`;
    const outcomes = await Promise.allSettled([
      acquireImportLease(first, actor),
      acquireImportLease(second, actor),
    ]);
    expect(outcomes.filter((item) => item.status === "fulfilled")).toHaveLength(
      1,
    );
    const owned = outcomes.find((item) => item.status === "fulfilled");
    if (owned?.status !== "fulfilled") throw new Error("No admitted lease");
    await first.importConversionLease.update({
      where: { userId: actor },
      data: { expiresAt: new Date(0) },
    });
    const replacement = await acquireImportLease(second, actor);
    await releaseImportLease(first, actor, owned.value);
    expect(
      await first.importConversionLease.findUnique({
        where: { userId: actor },
      }),
    ).toMatchObject({ leaseId: replacement });
    await releaseImportLease(second, actor, replacement);
    expect(
      await first.importConversionLease.count({ where: { userId: actor } }),
    ).toBe(0);
  }));
it("terminates at the configured deadline and releases the request lease", async () =>
  withTestConnections(async (database) => {
    const previous = process.env.IMPORT_TIMEOUT_MS;
    process.env.IMPORT_TIMEOUT_MS = "1";
    const actor = `timeout-${crypto.randomUUID()}`;
    try {
      const { previewConversion } = await import("./import-worker");
      const bytes = await readFile(
        "src/s-core/fixtures/import/quarter.musicxml",
      );
      await expect(
        previewConversion(database, actor, {
          bytes,
          sourceName: "quarter.musicxml",
          options: { mode: "PRESERVE" },
        }),
      ).rejects.toThrow("IMPORT_TIMEOUT");
      expect(
        await database.importConversionLease.count({
          where: { userId: actor },
        }),
      ).toBe(0);
    } finally {
      if (previous === undefined) delete process.env.IMPORT_TIMEOUT_MS;
      else process.env.IMPORT_TIMEOUT_MS = previous;
    }
  }));
it("limits the total workers across actors and frees capacity on release", async () =>
  withTestConnections(async (first, second) => {
    const previous = process.env.IMPORT_MAX_CONCURRENT_WORKERS;
    process.env.IMPORT_MAX_CONCURRENT_WORKERS = "1";
    const actor = `global-${crypto.randomUUID()}`,
      other = `global-${crypto.randomUUID()}`;
    let lease: string | undefined, otherLease: string | undefined;
    try {
      lease = await acquireImportLease(first, actor);
      await expect(acquireImportLease(second, other)).rejects.toThrow(
        "IMPORT_RESOURCE_BUSY",
      );
      await releaseImportLease(first, actor, lease);
      otherLease = await acquireImportLease(second, other);
      expect(otherLease).toBeDefined();
    } finally {
      if (lease) await releaseImportLease(first, actor, lease);
      if (otherLease) await releaseImportLease(second, other, otherLease);
      if (previous === undefined)
        delete process.env.IMPORT_MAX_CONCURRENT_WORKERS;
      else process.env.IMPORT_MAX_CONCURRENT_WORKERS = previous;
    }
  }));

it("keeps the actual version through the real worker for all eight XML/MXL combinations", async () => {
  for (const version of ["2.0", "3.0", "3.1", "4.0"]) {
    for (const extension of ["musicxml", "mxl"]) {
      const result = await runImportWorker({
        bytes: await readFile(
          `src/s-core/fixtures/import/musicxml-versions/study-${version}.${extension}`,
        ),
        sourceName: `study-${version}.${extension}`,
        options: { mode: "PRESERVE" },
      });
      expect(result.metadata.formatVersion).toBe(version);
      expect(result.validation.canPractice).toBe(true);
      expect(result.candidate.notes).toHaveLength(7);
    }
  }
}, 15_000);

it("respects lower configured input limits without weakening the heap budget", async () => {
  const old = process.env.IMPORT_MAX_INPUT_BYTES;
  try {
    process.env.IMPORT_MAX_INPUT_BYTES = "16";
    const { importLimits } = await import("./import-limits");
    expect(importLimits().workerHeapMb).toBe(128);
    await expect(
      runImportWorker({
        bytes: new Uint8Array(17),
        options: { mode: "PRESERVE" },
      }),
    ).rejects.toThrow("INPUT_LIMIT");
  } finally {
    if (old === undefined) delete process.env.IMPORT_MAX_INPUT_BYTES;
    else process.env.IMPORT_MAX_INPUT_BYTES = old;
  }
});
