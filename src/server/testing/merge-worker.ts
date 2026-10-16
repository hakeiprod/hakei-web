import { z } from "zod";
import { withActorAuthorization } from "../authentication/authorize";
import { PrismaClient } from "../../generated/prisma/client";
import { GitStore } from "../git-store";
import { mergeProposal } from "../merge-proposal";
const [root, input, stop] = process.argv.slice(2);
if (!root || !input || !stop) throw new Error("Test worker arguments missing");
const url = new URL(process.env.DATABASE_URL ?? "");
if (!url.pathname.endsWith("_test"))
  throw new Error("Merge test worker requires a dedicated _test database");
const request = z
  .strictObject({
    actorId: z.string(),
    proposalId: z.string(),
    expectedProposalVersion: z.number().int().nonnegative(),
    expectedRevisionId: z.string(),
    expectedRepositoryCommitOid: z.string(),
    key: z.string(),
  })
  .parse(JSON.parse(input));
const database = new PrismaClient();
const user = await database.user.findUniqueOrThrow({
  where: { id: request.actorId },
});
const session = await database.authSessionRecord.findFirstOrThrow({
  where: {
    userId: user.id,
    authVersion: user.authVersion,
    revokedAt: null,
    expiresAt: { gt: new Date() },
  },
});
await withActorAuthorization(
  {
    id: user.id,
    serviceRole: user.serviceRole,
    sid: session.sid,
    authVersion: session.authVersion,
  },
  () =>
    mergeProposal(database, new GitStore(root), request, (stage) => {
      // CLI worker deliberately skips cleanup to reproduce a process crash.
      // eslint-disable-next-line unicorn/no-process-exit
      if (stage === stop) process.exit(97);
    }),
);
await database.$disconnect();
