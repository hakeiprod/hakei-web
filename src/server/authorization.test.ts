// @vitest-environment node
import { expect, test, vi } from "vitest";
import { repositoryAccess } from "./authorization";
import type { AccessDatabase } from "./authorization";
function database(
  visibility: string,
  editScope = "INVITED",
  member: unknown = null,
): AccessDatabase {
  return {
    scoreRepository: {
      findUnique: vi.fn().mockResolvedValue({
        id: "repo",
        ownerId: "owner",
        visibility,
        editScope,
      }),
    },
    repositoryMember: { findUnique: vi.fn().mockResolvedValue(member) },
  } as unknown as AccessDatabase;
}
test("private data is concealed from anonymous users, invitees and unrelated users", async () => {
  for (const actor of [undefined, "other"])
    await expect(
      repositoryAccess(database("PRIVATE"), "repo", actor),
    ).rejects.toThrow("NOT_FOUND");
  await expect(
    repositoryAccess(
      database("PRIVATE", "INVITED", { role: "EDITOR" }),
      "repo",
      "invited",
    ),
  ).rejects.toThrow("NOT_FOUND");
  const access1 = await repositoryAccess(database("PRIVATE"), "repo", "owner");
  expect(access1.canManage).toBe(true);
});
test("public read never grants anonymous editing or owner bypass in all-users merge", async () => {
  const access2 = await repositoryAccess(
    database("PUBLIC", "ALL_USERS"),
    "repo",
  );
  expect(access2.canEdit).toBe(false);
  const access3 = await repositoryAccess(
    database("PUBLIC", "ALL_USERS"),
    "repo",
    "user",
  );
  expect(access3.canEdit).toBe(true);
  const access4 = await repositoryAccess(
    database("PUBLIC", "ALL_USERS"),
    "repo",
    "owner",
  );
  expect(access4.canMergeInvited).toBe(false);
});
test("invited editors require explicit merge privilege", async () => {
  const access5 = await repositoryAccess(
    database("INVITED", "INVITED", { role: "EDITOR", canMerge: false }),
    "repo",
    "editor",
  );
  expect(access5.canMergeInvited).toBe(false);
  const access6 = await repositoryAccess(
    database("INVITED", "INVITED", { role: "EDITOR", canMerge: true }),
    "repo",
    "editor",
  );
  expect(access6.canMergeInvited).toBe(true);
});
