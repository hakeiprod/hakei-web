import "server-only";
import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { emailSchema } from "./input";
import { databaseNow } from "./rate-limit";

export function recordPasswordChange(
  tx: Prisma.TransactionClient,
  userId: string,
  email: string,
  type: "PASSWORD_RESET" | "PASSWORD_CHANGED" | "PASSWORD_ADDED",
  requestId: string,
) {
  return tx.authChangeEvent.create({
    data: {
      userId,
      type,
      requestId,
      notice: { create: { recipientSnapshot: emailSchema.parse(email) } },
    },
  });
}
/** At-least-once delivery: no secrets in jobs; an uncertain SMTP acknowledgment may cause a duplicate notice. */
export async function deliverAuthNotices(
  database: PrismaClient,
  mailer: {
    sendChangeNotice: (recipient: string) => Promise<{ accepted: boolean }>;
  },
  limit = 20,
) {
  let delivered = 0;
  for (let index = 0; index < Math.min(Math.max(limit, 0), 100); index++) {
    const notice = await database.$transaction(async (tx) => {
      const now = await databaseNow(tx);
      const rows = await tx.$queryRaw<
        { eventId: string }[]
      >`SELECT "eventId" FROM "AuthNotice" WHERE "status" IN ('PENDING', 'SENDING') AND "nextAttemptAt" <= ${now} ORDER BY "nextAttemptAt", "eventId" FOR UPDATE SKIP LOCKED LIMIT 1`;
      if (!rows[0]) return null;
      return tx.authNotice.update({
        where: { eventId: rows[0].eventId },
        data: {
          status: "SENDING",
          attempts: { increment: 1 },
          nextAttemptAt: new Date(now.getTime() + 60_000),
        },
      });
    });
    if (!notice) break;
    let accepted = false;
    try {
      const result = await mailer.sendChangeNotice(notice.recipientSnapshot);
      accepted = result.accepted;
    } catch {
      /* Retry without exposing delivery errors. */
    }
    const now = await databaseNow(database);
    const changed = await database.authNotice.updateMany({
      where: {
        eventId: notice.eventId,
        status: "SENDING",
        attempts: notice.attempts,
      },
      data: {
        status: accepted ? "DELIVERED" : "PENDING",
        nextAttemptAt: new Date(
          now.getTime() +
            Math.min(
              24 * 60 * 60_000,
              60_000 * 2 ** Math.min(notice.attempts, 10),
            ),
        ),
      },
    });
    if (accepted && changed.count === 1) delivered++;
  }
  return { delivered };
}
