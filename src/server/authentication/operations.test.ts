import type { PrismaClient } from "../../generated/prisma/client";
import { expect, it, vi } from "vitest";
import { authenticationEnvironment } from "../testing/authentication";
import { authenticationOperation } from "./operations";

it("rejects forbidden origins and oversized bodies before any database access", async () => {
  const access = vi.fn(() => {
    throw new Error("unexpected database access");
  });
  const database = new Proxy({} as PrismaClient, { get: access });
  const environment = authenticationEnvironment();
  for (const [origin, body, code] of [
    ["https://other.example", "{}", "FORBIDDEN"],
    [
      environment.AUTH_PUBLIC_ORIGIN,
      "x".repeat(16 * 1024 + 1),
      "LIMIT_EXCEEDED",
    ],
    [environment.AUTH_PUBLIC_ORIGIN, "{", "VALIDATION_FAILED"],
  ]) {
    const response = await authenticationOperation(
      database,
      environment,
      "requestRegistration",
      new Request(
        "http://localhost:3000/api/account-auth/requestRegistration",
        {
          method: "POST",
          headers: { origin, "content-type": "application/json" },
          body,
        },
      ),
    );
    expect(response.ok).toBe(false);
    if (!response.ok) expect(response.error.code).toBe(code);
    expect(JSON.stringify(response)).not.toContain(
      body.length > 2 ? body : "unexpected database access",
    );
  }
  expect(access).not.toHaveBeenCalled();
});
it("rejects disabled GitHub addition before database access or secret processing", async () => {
  const access = vi.fn(() => {
    throw new Error("unexpected database access");
  });
  const database = new Proxy({} as PrismaClient, { get: access });
  const response = await authenticationOperation(
    database,
    authenticationEnvironment(),
    "confirmPasswordAddition",
    new Request(
      "http://localhost:3000/api/account-auth/confirmPasswordAddition",
      {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          token: "x".repeat(43),
          newPassword: "owner-selected-password",
        }),
      },
    ),
  );
  expect(response.ok).toBe(false);
  if (!response.ok) expect(response.error.code).toBe("AUTH_METHOD_UNAVAILABLE");
  expect(access).not.toHaveBeenCalled();
  expect(JSON.stringify(response)).not.toContain("owner-selected-password");
});
