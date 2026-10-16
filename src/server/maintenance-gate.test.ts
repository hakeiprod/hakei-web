// @vitest-environment node
import { mkdtemp, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { withWriteLease } from "./maintenance-gate";
import { withMaintenanceGate } from "./maintenance-freeze";
it("waits for active writes, rejects new ones and releases a verified checkpoint", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hakei-gate-"));
  try {
    let finish!: () => void, entered!: () => void;
    const ready = new Promise<void>((done) => {
      entered = done;
    });
    const writer = withWriteLease(root, async () => {
      entered();
      await new Promise<void>((done) => {
        finish = done;
      });
    });
    await ready;
    let frozen = false;
    const checkpoint = withMaintenanceGate(root, async () => {
      frozen = true;
      await expect(withWriteLease(root, async () => {})).rejects.toThrow(
        "MAINTENANCE",
      );
    });
    await new Promise((done) => setTimeout(done, 30));
    expect(frozen).toBe(false);
    finish();
    await writer;
    await checkpoint;
    await withWriteLease(root, async () => {});
    await expect(access(path.join(root, ".maintenance"))).rejects.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
it("keeps a failed checkpoint frozen for operator inspection", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hakei-gate-failed-"));
  try {
    await expect(
      withMaintenanceGate(root, async () => {
        throw new Error("verification-failed");
      }),
    ).rejects.toThrow("verification-failed");
    await access(path.join(root, ".maintenance"));
    await expect(withWriteLease(root, async () => {})).rejects.toThrow(
      "MAINTENANCE",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
