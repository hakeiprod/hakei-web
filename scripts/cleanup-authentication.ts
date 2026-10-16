import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { cleanupAuthentication } from "../src/server/authentication/cleanup";
import { configuredWriteLease } from "../src/server/maintenance-gate";
const database = new PrismaClient();
try {
  console.log(
    await configuredWriteLease(() => cleanupAuthentication(database)),
  );
} finally {
  await database.$disconnect();
}
