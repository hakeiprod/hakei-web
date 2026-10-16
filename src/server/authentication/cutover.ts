import "server-only";
import type { PrismaClient } from "../../generated/prisma/client";
import { databaseNow } from "./rate-limit";
/** Run with all application replicas frozen. Secret rotation is a separate deployment operation. */
export function revokeLegacyAuthentication(database: PrismaClient) {
  return database.$transaction(
    async (tx) => {
      await tx.$executeRaw`LOCK TABLE "users" IN SHARE ROW EXCLUSIVE MODE`;
      const now = await databaseNow(tx);
      const users = await tx.user.updateMany({
        data: { authVersion: { increment: 1 } },
      });
      const sessions = await tx.authSessionRecord.updateMany({
        where: { revokedAt: null },
        data: { revokedAt: now },
      });
      const legacy = await tx.session.deleteMany();
      const challenges = await tx.authChallenge.updateMany({
        where: { revokedAt: null },
        data: { revokedAt: now },
      });
      const proofs = await tx.reauthIntent.updateMany({
        where: { revokedAt: null },
        data: { revokedAt: now },
      });
      return {
        users: users.count,
        sessions: sessions.count,
        legacy: legacy.count,
        challenges: challenges.count,
        proofs: proofs.count,
      };
    },
    { timeout: 30_000 },
  );
}
