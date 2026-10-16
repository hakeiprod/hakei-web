// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
vi.mock("./auth", () => ({
  requireActor: async () => ({ id: "user", serviceRole: "USER" }),
}));
import { runAction } from "./action-result";
import { withMaintenanceGate } from "./maintenance-freeze";
it("returns a retryable maintenance response without running a mutation", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hakei-action-gate-"));
  vi.stubEnv("SCORE_GIT_ROOT", root);
  const operation = vi.fn();
  try {
    await withMaintenanceGate(root, async () => {
      expect(await runAction(operation)).toMatchObject({
        ok: false,
        error: { code: "MAINTENANCE", retryable: true },
      });
      expect(operation).not.toHaveBeenCalled();
    });
  } finally {
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  }
});
