import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { backfillEmailIdentities } from "../src/server/authentication/backfill";
import { withMaintenanceGate } from "../src/server/maintenance-freeze";

const root = process.env.SCORE_GIT_ROOT;
if (!root) throw new Error("SCORE_GIT_ROOT is required");
const database = new PrismaClient();
try {
  console.log(
    await withMaintenanceGate(root, () => backfillEmailIdentities(database)),
  );
} finally {
  await database.$disconnect();
}
