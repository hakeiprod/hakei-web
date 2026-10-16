import { expect, it, vi } from "vitest";
import { boundedBody, domainBody, guardAuthRequest } from "./http";

const origin = "https://example.invalid";
function request(size: number, headers: Record<string, string> = {}) {
  const bytes = new TextEncoder().encode(" ".repeat(size));
  return new Request(`${origin}/api/account-auth/requestRegistration`, {
    method: "POST",
    headers: { origin, "content-type": "application/json", ...headers },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(bytes.subarray(0, 100));
        controller.enqueue(bytes.subarray(100));
        controller.close();
      },
    }),
    duplex: "half",
  } as RequestInit);
}
it("accepts exactly 16KiB and rejects the next byte without trusting Content-Length", async () => {
  const bounded = await boundedBody(request(16_384));
  expect(bounded.byteLength).toBe(16_384);
  const headerCases: Record<string, string>[] = [
    {},
    { "content-length": "1" },
    { "content-length": "16384" },
  ];
  for (const headers of headerCases) {
    await expect(boundedBody(request(16_385, headers))).rejects.toThrow(
      "LIMIT_EXCEEDED",
    );
  }
});
it("validates operation, fixed origin and content type before parsing", async () => {
  await expect(
    domainBody(request(2), "https://other.invalid", "requestRegistration"),
  ).rejects.toThrow("FORBIDDEN");
  await expect(domainBody(request(2), origin, "unknown")).rejects.toThrow(
    "NOT_FOUND",
  );
  await expect(
    domainBody(
      request(2, { "content-type": "text/plain" }),
      origin,
      "requestRegistration",
    ),
  ).rejects.toThrow("VALIDATION_FAILED");
});
it("does not call standard auth handlers for oversized Credentials or disabled GitHub", async () => {
  const handler = vi.fn(async () => new Response("ok"));
  const oversized = new Request(`${origin}/api/auth/callback/credentials`, {
    method: "POST",
    body: "x".repeat(16_385),
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
  const rejected = await guardAuthRequest(oversized, handler, false);
  expect(rejected.status).toBe(413);
  for (const method of ["GET", "POST"]) {
    for (const operation of ["signin", "callback"]) {
      const response = await guardAuthRequest(
        new Request(`${origin}/api/auth/${operation}/github?code=private`, {
          method,
        }),
        handler,
        false,
      );
      expect(response.status).toBe(404);
    }
  }
  expect(handler).not.toHaveBeenCalled();
});
it("preserves a bounded form body for the standard handler", async () => {
  const handler = vi.fn(
    async (value: Request) => new Response(await value.text()),
  );
  const value = new Request(`${origin}/api/auth/callback/credentials`, {
    method: "POST",
    body: "csrfToken=example&email=a%40example.invalid",
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
  const response = await guardAuthRequest(value, handler, false);
  expect(await response.text()).toBe(
    "csrfToken=example&email=a%40example.invalid",
  );
  expect(handler).toHaveBeenCalledTimes(1);
});

it("rejects malformed UTF-8 before domain parsing", async () => {
  const value = new Request(`${origin}/api/account-auth/requestRegistration`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: new Uint8Array([0xff]),
  });
  await expect(
    domainBody(value, origin, "requestRegistration"),
  ).rejects.toThrow("VALIDATION_FAILED");
});
