import { configuredWriteLease } from "../src/server/maintenance-gate";
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { GitStore } from "../src/server/git-store";
import { recoverInitialPreparations } from "../src/server/git-acceptance";
import { recoverCollaborationPreparations } from "../src/server/collaboration-recovery";
import { recoverGitPublications } from "../src/server/git-publication";
const database = new PrismaClient();
const root = process.env.SCORE_GIT_ROOT;
if (!root) throw new Error("SCORE_GIT_ROOT is required");
try {
  await configuredWriteLease(async () => {
    const git = new GitStore(root);
    console.log(await recoverInitialPreparations(database, git));
    console.log(await recoverCollaborationPreparations(database, git));
    console.log(await recoverGitPublications(database, git));
  });
} finally {
  await database.$disconnect();
}
