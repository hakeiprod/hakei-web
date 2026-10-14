// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { expect, it, vi } from "vitest";
import { maintenanceAdapter } from "./maintenance-adapter";
import { withMaintenanceGate } from "./maintenance-freeze";
it("blocks authentication writes during a checkpoint while retaining read access", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hakei-auth-gate-"));
  vi.stubEnv("SCORE_GIT_ROOT", root);
  const session = { sessionToken: "test", userId: "user", expires: new Date() },
    createSession = vi.fn(async () => session),
    getUser = vi.fn(async () => null),
    adapter = maintenanceAdapter({ createSession, getUser });
  try {
    await withMaintenanceGate(root, async () => {
      await expect(adapter.createSession!(session)).rejects.toThrow(
        "MAINTENANCE",
      );
      expect(createSession).not.toHaveBeenCalled();
      expect(await adapter.getUser!("user")).toBeNull();
    });
    expect(await adapter.createSession!(session)).toEqual(session);
  } finally {
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  }
});
