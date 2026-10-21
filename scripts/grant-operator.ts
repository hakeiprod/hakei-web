import { configuredWriteLease } from "../src/server/maintenance-gate";
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

// Local operator command, never exposed as an HTTP action.
const [userId, reason, ...extra] = process.argv.slice(2);
if (!userId || !reason?.trim() || extra.length > 0) {
  throw new Error(
    'Usage: npx tsx scripts/grant-operator.ts <existing-user-id> "<audit reason>"',
  );
}
const database = new PrismaClient();
try {
  await configuredWriteLease(async () => {
    await database.$transaction(
      async (transaction) => {
        const user = await transaction.user.findUniqueOrThrow({
          where: { id: userId },
        });
        await transaction.user.update({
          where: { id: userId },
          data: { serviceRole: "OPERATOR" },
        });
        await transaction.auditEvent.create({
          data: {
            actorId: "local-operator-cli",
            entityType: "User",
            entityId: userId,
            action: "GRANT_OPERATOR",
            before: { serviceRole: user.serviceRole },
            after: { serviceRole: "OPERATOR" },
            reason: reason.trim(),
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
    console.log("Operator role granted and audited.");
  });
} finally {
  await database.$disconnect();
}
