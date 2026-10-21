import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  verifyBackupFiles,
  verifyRestoredScoreGit,
} from "../src/server/score-backup";
const [destination, mode] = process.argv.slice(2);
if (!destination || (mode && mode !== "--restored-db"))
  throw new Error(
    "Usage: verify-score-git.ts <backup-directory> [--restored-db]",
  );
if (mode) {
  const database = new PrismaClient();
  try {
    console.log(await verifyRestoredScoreGit(database, destination));
  } finally {
    await database.$disconnect();
  }
} else {
  const manifest = await verifyBackupFiles(destination);
  console.log({ checkpointId: manifest.checkpointId, verified: true });
}
