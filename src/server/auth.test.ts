// @vitest-environment node
import { expect, test, vi } from "vitest";
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/prisma", () => {
  const database = {
    user: { findUnique: vi.fn() },
    authSessionRecord: {
      findUnique: vi.fn(async () => ({
        sid: "test-sid",
        userId: "user",
        authVersion: 0,
        expiresAt: new Date("2099-01-01"),
        revokedAt: null,
      })),
    },
    $queryRaw: vi.fn(async () => [{ now: new Date() }]),
  };
  return {
    prisma: {
      ...database,
      $transaction: vi.fn(
        (operation: (value: typeof database) => Promise<unknown>) =>
          operation(database),
      ),
    },
  };
});
import { auth } from "@/auth";
import { prisma } from "@/prisma";
import { requireActor, requireOperator } from "./auth";

test("missing or revoked session cannot act", async () => {
  vi.mocked(auth).mockResolvedValueOnce(null as never);
  await expect(requireActor()).rejects.toThrow("UNAUTHENTICATED");
  vi.mocked(auth).mockResolvedValueOnce({
    user: { id: "deleted" },
    sid: "test-sid",
    authVersion: 0,
  } as never);
  vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
  await expect(requireActor()).rejects.toThrow("UNAUTHENTICATED");
});
test("operator status comes from current database row, never session claims", async () => {
  vi.mocked(auth).mockResolvedValue({
    user: { id: "user", serviceRole: "OPERATOR" },
    sid: "test-sid",
    authVersion: 0,
  } as never);
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    id: "user",
    authVersion: 0,
    serviceRole: "USER",
  } as never);
  await expect(requireOperator()).rejects.toThrow("FORBIDDEN");
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    id: "user",
    authVersion: 0,
    serviceRole: "OPERATOR",
  } as never);
  await expect(requireOperator()).resolves.toMatchObject({ id: "user" });
});
