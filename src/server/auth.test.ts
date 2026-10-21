// @vitest-environment node
import { expect, test, vi } from "vitest";
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
import { auth } from "@/auth";
import { prisma } from "@/prisma";
import { requireActor, requireOperator } from "./auth";
test("missing session or deleted user cannot act", async () => {
  vi.mocked(auth).mockResolvedValueOnce(null as never);
  await expect(requireActor()).rejects.toThrow("UNAUTHENTICATED");
  vi.mocked(auth).mockResolvedValueOnce({ user: { id: "deleted" } } as never);
  vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
  await expect(requireActor()).rejects.toThrow("UNAUTHENTICATED");
});
test("operator status comes from the current DB row, not session claims", async () => {
  vi.mocked(auth).mockResolvedValue({
    user: { id: "user", serviceRole: "OPERATOR" },
  } as never);
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    id: "user",
    serviceRole: "USER",
  } as never);
  await expect(requireOperator()).rejects.toThrow("FORBIDDEN");
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    id: "user",
    serviceRole: "OPERATOR",
  } as never);
  await expect(requireOperator()).resolves.toEqual({
    id: "user",
    serviceRole: "OPERATOR",
  });
});
