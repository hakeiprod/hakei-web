import { PrismaClient } from "../../generated/prisma/client";
import { GitStore } from "../git-store";
import { acceptInitialScore, type AcceptanceStage } from "../git-acceptance";
const [root, serializedInput, stop] = process.argv.slice(2);
if (!root || !serializedInput || !stop)
  throw new Error("Worker test arguments missing");
const database = new PrismaClient();
await acceptInitialScore(
  database,
  new GitStore(root),
  JSON.parse(serializedInput),
  (stage) => {
    // This file is a CLI test worker: a hard exit deliberately skips finally cleanup.
    // eslint-disable-next-line unicorn/no-process-exit
    if (stage === (stop as AcceptanceStage)) process.exit(97);
  },
);
await database.$disconnect();
