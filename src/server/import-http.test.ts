// @vitest-environment node
import { expect, it, vi } from "vitest";
import {
  readImportBody,
  requireImportOrigin,
  importHttpError,
} from "./import-http";
it("counts actual streamed bytes even without a trusted content length", async () => {
  const request = new Request("https://hakei.test/api/score-import/preview", {
    method: "POST",
    body: new Uint8Array(11),
  });
  await expect(readImportBody(request, 10)).rejects.toThrow("INPUT_LIMIT");
});
const request = (origin: string) =>
  new Request("https://hakei.test/api/score-import/preview", {
    headers: { origin },
  });
it("allows only requests from this origin", () => {
  expect(() =>
    requireImportOrigin(request("https://hakei.test")),
  ).not.toThrow();
  expect(() => requireImportOrigin(request("https://other.test"))).toThrow(
    "FORBIDDEN",
  );
});
it("maps limits and failures without revealing parser content or secrets", async () => {
  expect(importHttpError(new Error("INPUT_LIMIT")).status).toBe(413);
  expect(importHttpError(new Error("IMPORT_BUSY")).status).toBe(429);
  expect(importHttpError(new Error("IMPORT_TIMEOUT")).status).toBe(504);
  const response = importHttpError(new Error("private-score-secret"));
  expect(await response.text()).not.toContain("private-score-secret");
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("cancels a stalled body at its deadline", async () => {
  const canceled = vi.fn();
  const body = new ReadableStream<Uint8Array>({ cancel: canceled });
  const request = new Request("https://hakei.test/api/score-import/preview", {
    method: "POST",
    body,
    duplex: "half",
  } as RequestInit);
  await expect(readImportBody(request, 1024, 1)).rejects.toThrow(
    "IMPORT_TIMEOUT",
  );
  expect(canceled).toHaveBeenCalledOnce();
});
