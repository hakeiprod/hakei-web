import { PrismaClient } from "../../generated/prisma/client";
import { GitStore } from "../git-store";
import { mergeProposal } from "../merge-proposal";
const [root, input, stop] = process.argv.slice(2);
if (!root || !input || !stop) throw new Error("Test worker arguments missing");
const database = new PrismaClient();
await mergeProposal(
  database,
  new GitStore(root),
  JSON.parse(input),
  (stage) => {
    // CLI worker deliberately skips cleanup to reproduce a process crash.
    // eslint-disable-next-line unicorn/no-process-exit
    if (stage === stop) process.exit(97);
  },
);
await database.$disconnect();
