import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { backupScoreGit } from "../src/server/score-backup";
const [destination] = process.argv.slice(2),
  root = process.env.SCORE_GIT_ROOT,
  url = process.env.DATABASE_URL;
if (!destination || !root || !url)
  throw new Error(
    "Provide an absolute backup destination, SCORE_GIT_ROOT and DATABASE_URL",
  );
const database = new PrismaClient();
try {
  console.log(await backupScoreGit(database, root, destination, url));
} finally {
  await database.$disconnect();
}
