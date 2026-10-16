import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { authenticationRequest } from "./maintenance";
import { authenticationContext } from "./request-context";

it("refuses auth writes during maintenance before running the handler", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hakei-auth-maintenance-"));
  vi.stubEnv("SCORE_GIT_ROOT", root);
  try {
    await mkdir(path.join(root, ".maintenance"));
    const handler = vi.fn(async () => new Response("ok"));
    for (const [method, operation] of [
      ["POST", "signout"],
      ["POST", "callback/credentials"],
      ["GET", "callback/github"],
    ]) {
      const response = await authenticationRequest(
        new Request(`http://localhost/api/auth/${operation}`, { method }),
        handler,
      );
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "MAINTENANCE" });
    }
    expect(handler).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  }
});
it("discards cookie changes when DB verification failed inside the standard handler", async () => {
  const response = await authenticationRequest(
    new Request("http://localhost/api/auth/session"),
    async () => {
      const context = authenticationContext();
      if (!context) throw new Error("missing request scope");
      context.databaseUnavailable = true;
      return new Response("ok", {
        headers: { "set-cookie": "test-only=value" },
      });
    },
  );
  expect(response.status).toBe(503);
  expect(response.headers.has("set-cookie")).toBe(false);
});
