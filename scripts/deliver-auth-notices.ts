import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { authenticationConfig } from "../src/server/authentication/config";
import { authenticationMailer } from "../src/server/authentication/mail";
import { deliverAuthNotices } from "../src/server/authentication/notices";
import { configuredWriteLease } from "../src/server/maintenance-gate";
const config = authenticationConfig(process.env);
if (!config.enabled) throw new Error("EMAIL_PASSWORD_ENABLED is required");
const database = new PrismaClient();
try {
  console.log(
    await configuredWriteLease(() =>
      deliverAuthNotices(database, authenticationMailer(config)),
    ),
  );
} finally {
  await database.$disconnect();
}
