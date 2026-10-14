// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import sheet from "@/s-core/fixtures/import/quarter-sheet.json";
const { actor, convert } = vi.hoisted(() => ({
  actor: vi.fn(),
  convert: vi.fn(),
}));
vi.mock("@/server/maintenance-gate", () => ({
  configuredWriteLease: (operation: () => Promise<unknown>) => operation(),
}));
vi.mock("@/prisma", () => ({ prisma: {} }));
vi.mock("@/server/auth", () => ({ requireActor: actor }));
vi.mock("@/server/import-worker", () => ({
  processImportRequest: (
    _database: unknown,
    _actor: string,
    handler: (run: typeof convert) => Promise<unknown>,
  ) => handler(convert),
}));
import { verifyPreview } from "@/server/import-preview-token";
import { POST } from "./route";
const result = {
  candidate: sheet,
  issues: [],
  metadata: {
    format: "MIDI",
    formatVersion: "SMF-1.0",
    converterVersion: "v1",
    options: { mode: "PRESERVE" },
  },
  validation: {
    validatorVersion: "v1",
    canPractice: true,
    canGame: true,
    unresolvedIssueIds: [],
  },
  canPractice: true,
  canGame: true,
};
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
function request(origin = "https://hakei.test") {
  const form = new FormData();
  form.set("file", new File(["MThd"], "score.mid", { type: "audio/midi" }));
  form.set("options", JSON.stringify({ mode: "PRESERVE" }));
  return new Request("https://hakei.test/api/score-import/preview", {
    method: "POST",
    headers: { origin },
    body: form,
  });
}
it("authenticates before conversion and returns a noncached actor-bound preview", async () => {
  vi.stubEnv(
    "IMPORT_PREVIEW_SECRET",
    "test-secret-at-least-32-characters-long",
  );
  actor.mockResolvedValue({ id: "alice" });
  convert.mockResolvedValue(result);
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(convert.mock.calls[0][0].sourceName).toBe("score.mid");
  const body = await response.json();
  expect(
    verifyPreview(
      body.previewToken,
      "alice",
      result,
      "test-secret-at-least-32-characters-long",
    ).actorId,
  ).toBe("alice");
});
it("rejects missing authentication and foreign origins before processing file bytes", async () => {
  actor.mockRejectedValueOnce(new Error("UNAUTHENTICATED"));
  const unauthenticated = await POST(request());
  expect(unauthenticated.status).toBe(401);
  expect(convert).not.toHaveBeenCalled();
  actor.mockResolvedValue({ id: "alice" });
  const forbidden = await POST(request("https://other.test"));
  expect(forbidden.status).toBe(403);
  expect(convert).not.toHaveBeenCalled();
});
