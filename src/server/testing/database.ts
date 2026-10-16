import { withActorResolver } from "../authentication/authorize";
import { createSession } from "../authentication/sessions";
import { PrismaClient } from "../../generated/prisma/client";

export function testDatabase() {
  const value = process.env.TEST_DATABASE_URL;
  if (!value) throw new Error("TEST_DATABASE_URL is required");
  const url = new URL(value);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.pathname.endsWith("_test")
  ) {
    throw new Error(
      "TEST_DATABASE_URL must target a dedicated PostgreSQL _test database",
    );
  }
  return new PrismaClient({ datasourceUrl: value });
}

/** Two independent pools; always disconnected even when a concurrency assertion fails. */
export async function withTestConnections<T>(
  run: (first: PrismaClient, second: PrismaClient) => Promise<T>,
): Promise<T> {
  const first = testDatabase();
  const second = testDatabase();
  try {
    await Promise.all([first.$connect(), second.$connect()]);
    const actors = new Map<
      string,
      Promise<{
        id: string;
        sid: string;
        authVersion: number;
        serviceRole: string;
      } | null>
    >();
    return await withActorResolver(
      async (id) => {
        let actor = actors.get(id);
        if (!actor) {
          actor = (async () => {
            const user = await first.user.findUnique({ where: { id } });
            if (!user) return null;
            const session = await createSession(first, {
              userId: id,
              authVersion: user.authVersion,
              method: "github",
            });
            return {
              id,
              sid: session.sid,
              authVersion: user.authVersion,
              serviceRole: user.serviceRole,
            };
          })();
          actors.set(id, actor);
        }
        return actor;
      },
      () => run(first, second),
    );
  } finally {
    await Promise.allSettled([first.$disconnect(), second.$disconnect()]);
  }
}
