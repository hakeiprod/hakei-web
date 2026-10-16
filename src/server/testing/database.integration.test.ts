import { expect, test } from "vitest";
import { withTestConnections } from "./database";

test("dedicated database has independently usable concurrent connections", async () => {
  await withTestConnections(async (first, second) => {
    const [a, b] = await Promise.all([
      first.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() as pid`,
      second.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() as pid`,
    ]);
    expect(a[0].pid).not.toBe(b[0].pid);
  });
});
