import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test } from "vitest";
import { withTestConnections } from "./testing/database";
const execute = promisify(execFile);
const run = (id: string, reason: string, root: string) =>
  execute(
    process.execPath,
    [
      "--conditions=react-server",
      "--import",
      "tsx",
      "scripts/grant-operator.ts",
      id,
      reason,
    ],
    {
      env: {
        ...process.env,
        DATABASE_URL: process.env.TEST_DATABASE_URL,
        SCORE_GIT_ROOT: root,
      },
      timeout: 10_000,
    },
  );
test("operator CLI changes only an existing user and records the reason atomically", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hakei-operator-cli-"));
  try {
    await withTestConnections(async (database) => {
      const user = await database.user.create({ data: {} });
      try {
        await expect(run(user.id, " ", root)).rejects.toThrow();
        expect(
          await database.user.findUnique({ where: { id: user.id } }),
        ).toMatchObject({ serviceRole: "USER" });
        await run(user.id, "Bootstrap approved by local operator", root);
        expect(
          await database.user.findUnique({ where: { id: user.id } }),
        ).toMatchObject({ serviceRole: "OPERATOR" });
        expect(
          await database.auditEvent.findMany({
            where: { entityId: user.id, action: "GRANT_OPERATOR" },
          }),
        ).toEqual([
          expect.objectContaining({
            reason: "Bootstrap approved by local operator",
            before: { serviceRole: "USER" },
            after: { serviceRole: "OPERATOR" },
          }),
        ]);
        await expect(
          run("nonexistent-user", "Should fail", root),
        ).rejects.toThrow();
        expect(
          await database.user.findUnique({ where: { id: "nonexistent-user" } }),
        ).toBeNull();
      } finally {
        await database.auditEvent.deleteMany({ where: { entityId: user.id } });
        await database.user.delete({ where: { id: user.id } });
      }
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
