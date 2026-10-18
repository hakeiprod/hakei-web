// @vitest-environment node
import { expect, test, vi } from "vitest";
import { z } from "zod";
vi.mock("./maintenance-gate", () => ({
  configuredWriteLease: (operation: () => Promise<unknown>) => operation(),
}));
vi.mock("./auth", () => ({ requireActor: vi.fn() }));
import { requireActor } from "./auth";
import { runAction } from "./action-result";
test("authentication precedes mutation; internal errors never reach the public DTO", async () => {
  vi.mocked(requireActor).mockRejectedValueOnce(new Error("UNAUTHENTICATED"));
  const operation = vi.fn();
  const anonymous = await runAction(operation);
  expect(anonymous).toMatchObject({
    ok: false,
    error: { code: "UNAUTHENTICATED" },
  });
  expect(operation).not.toHaveBeenCalled();
  vi.mocked(requireActor).mockResolvedValue({
    id: "user",
    serviceRole: "USER",
  });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const failure = await runAction(async () => {
      throw new Error("postgresql://secret-password@example.invalid/private");
    });
    expect(failure).toMatchObject({
      ok: false,
      error: { code: "TEMPORARY_FAILURE", retryable: true },
    });
    expect(JSON.stringify(failure)).not.toContain("secret-password");
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret-password");
    const invalid = await runAction(async () => z.int().parse("bad"));
    expect(invalid).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_FAILED" },
    });
  } finally {
    log.mockRestore();
  }
});
