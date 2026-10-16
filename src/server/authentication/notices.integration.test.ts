import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { withTestConnections } from "../testing/database";
import { recordPasswordChange, deliverAuthNotices } from "./notices";
it("retries a failed secret-free notification without undoing the committed change", () =>
  withTestConnections(async (database) => {
    const user = await database.user.create({
      data: { email: `${randomUUID()}@example.invalid` },
    });
    try {
      const event = await database.$transaction((tx) =>
        recordPasswordChange(
          tx,
          user.id,
          user.email!,
          "PASSWORD_CHANGED",
          randomUUID(),
        ),
      );
      await deliverAuthNotices(database, {
        sendChangeNotice: async () => ({ accepted: false }),
      });
      const notice = await database.authNotice.findUniqueOrThrow({
        where: { eventId: event.id },
      });
      expect(notice.status).toBe("PENDING");
      expect(notice.attempts).toBe(1);
      expect(
        await database.authChangeEvent.count({ where: { id: event.id } }),
      ).toBe(1);
      await database.authNotice.update({
        where: { eventId: event.id },
        data: { nextAttemptAt: new Date(0) },
      });
      await deliverAuthNotices(database, {
        sendChangeNotice: async () => ({ accepted: true }),
      });
      const delivered = await database.authNotice.findUniqueOrThrow({
        where: { eventId: event.id },
      });
      expect(delivered.status).toBe("DELIVERED");
      expect(delivered.attempts).toBe(2);
    } finally {
      await database.user.delete({ where: { id: user.id } });
    }
  }));
