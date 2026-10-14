import { configuredWriteLease } from "../src/server/maintenance-gate";
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { GitStore } from "../src/server/git-store";
import { migrateLegacyScores } from "../src/server/legacy-score-assignment";
const [operatorId] = process.argv.slice(2);
const root = process.env.SCORE_GIT_ROOT;
if (!operatorId || !root)
  throw new Error("Provide existing operator ID and SCORE_GIT_ROOT");
const database = new PrismaClient();
try {
  await configuredWriteLease(async () => {
    console.log(
      JSON.stringify(
        await migrateLegacyScores(database, new GitStore(root), operatorId),
        null,
        2,
      ),
    );
  });
} finally {
  await database.$disconnect();
}
