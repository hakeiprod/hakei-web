import "server-only";
import { z } from "zod";
import type { PrismaClient } from "../../generated/prisma/client";

/** Run during maintenance. Reports opaque IDs only and never merges users. */
export function backfillEmailIdentities(database: PrismaClient) {
  return database.$transaction(async (tx) => {
    await tx.$executeRaw`LOCK TABLE "users" IN SHARE ROW EXCLUSIVE MODE`;
    await tx.$executeRaw`LOCK TABLE "EmailIdentity" IN SHARE ROW EXCLUSIVE MODE`;
    const users = await tx.user.findMany({ select: { id: true, email: true } });
    const groups = new Map<string, string[]>();
    const blockedUserIds: string[] = [];
    for (const user of users) {
      if (!user.email) continue;
      if (/[\r\n]/u.test(user.email)) {
        blockedUserIds.push(user.id);
        continue;
      }
      const parsed = z.email().safeParse(user.email.trim().toLowerCase());
      if (!parsed.success) {
        blockedUserIds.push(user.id);
        continue;
      }
      const ids = groups.get(parsed.data) ?? [];
      ids.push(user.id);
      groups.set(parsed.data, ids);
    }
    let created = 0;
    for (const [normalizedEmail, ids] of groups) {
      if (ids.length !== 1) {
        blockedUserIds.push(...ids);
        continue;
      }
      const userId = ids[0];
      const existing = await tx.emailIdentity.findFirst({
        where: { OR: [{ normalizedEmail }, { userId }] },
      });
      if (existing) {
        if (
          existing.userId !== userId ||
          existing.normalizedEmail !== normalizedEmail
        )
          blockedUserIds.push(userId);
        continue;
      }
      await tx.emailIdentity.create({
        data: { normalizedEmail, userId, state: "OAUTH_BOUND" },
      });
      created++;
    }
    return { created, blockedUserIds };
  });
}
