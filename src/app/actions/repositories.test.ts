// @vitest-environment node
import { expect, test, vi } from "vitest";
vi.mock("@/server/maintenance-gate", () => ({
  configuredWriteLease: (operation: () => Promise<unknown>) => operation(),
}));
vi.mock("@/prisma", () => ({ prisma: {} }));
vi.mock("@/server/auth", () => ({
  requireActor: vi
    .fn()
    .mockResolvedValue({ id: "real-user", serviceRole: "USER" }),
}));
vi.mock("@/server/repositories", () => ({
  createRepository: vi.fn().mockResolvedValue({ repositoryId: "repository" }),
}));
import { createRepository } from "./repositories";
import * as repositories from "@/server/repositories";
test("client-supplied actor and operator claims cannot override the authenticated identity", async () => {
  const result = await createRepository({
    name: "Music",
    visibility: "PUBLIC",
    editScope: "INVITED",
    key: "create",
    actorId: "forged-operator",
    serviceRole: "OPERATOR",
  });
  expect(result.ok).toBe(true);
  expect(repositories.createRepository).toHaveBeenCalledWith(
    {},
    {
      name: "Music",
      visibility: "PUBLIC",
      editScope: "INVITED",
      key: "create",
      actorId: "real-user",
    },
  );
});
