import "server-only";
import type { PrismaClient } from "../../generated/prisma/client";
import { databaseNow } from "./rate-limit";
const day = 24 * 60 * 60_000;
/** Caller holds the shared maintenance write lease; only inactive authentication metadata is removed. */
export function cleanupAuthentication(database: PrismaClient) {
  return database.$transaction(
    async (tx) => {
      const now = await databaseNow(tx),
        sevenDays = new Date(now.getTime() - 7 * day),
        yesterday = new Date(now.getTime() - day),
        ninetyDays = new Date(now.getTime() - 90 * day);
      const challenges = await tx.authChallenge.deleteMany({
        where: {
          OR: [
            { expiresAt: { lte: sevenDays } },
            { consumedAt: { lte: sevenDays } },
            { revokedAt: { lte: sevenDays } },
          ],
        },
      });
      const proofs = await tx.reauthIntent.deleteMany({
        where: {
          OR: [
            { expiresAt: { lte: sevenDays } },
            { consumedAt: { lte: sevenDays } },
            { revokedAt: { lte: sevenDays } },
          ],
        },
      });
      const sessions = await tx.authSessionRecord.deleteMany({
        where: {
          OR: [
            { expiresAt: { lte: sevenDays } },
            { revokedAt: { lte: sevenDays } },
          ],
        },
      });
      const attempts = await tx.authAttempt.deleteMany({
        where: {
          mailboxWindow: { windowEnd: { lte: yesterday } },
          sourceWindow: { windowEnd: { lte: yesterday } },
        },
      });
      const windows = await tx.authRateWindow.deleteMany({
        where: {
          windowEnd: { lte: yesterday },
          mailboxAttempts: { none: {} },
          sourceAttempts: { none: {} },
        },
      });
      const events = await tx.authChangeEvent.deleteMany({
        where: { occurredAt: { lte: ninetyDays } },
      });
      // Issuance takes the same identity lock. Recheck under lock rather than deleting a head that may just have acquired a fresh challenge.
      const candidates = await tx.$queryRaw<
        { id: string }[]
      >`SELECT "id" FROM "EmailIdentity" WHERE "state" = 'PENDING' AND "userId" IS NULL AND NOT EXISTS (SELECT 1 FROM "AuthChallengeHead" h JOIN "AuthChallenge" c ON c."headId" = h."id" WHERE h."identityId" = "EmailIdentity"."id") ORDER BY "id" FOR UPDATE SKIP LOCKED LIMIT 500`;
      let identities = 0;
      for (const candidate of candidates) {
        if (
          await tx.authChallenge.count({
            where: { head: { identityId: candidate.id } },
          })
        )
          continue;
        const removed = await tx.emailIdentity.deleteMany({
          where: { id: candidate.id, state: "PENDING", userId: null },
        });
        identities += removed.count;
      }
      return {
        challenges: challenges.count,
        proofs: proofs.count,
        sessions: sessions.count,
        attempts: attempts.count,
        windows: windows.count,
        events: events.count,
        identities,
      };
    },
    { timeout: 30_000 },
  );
}
