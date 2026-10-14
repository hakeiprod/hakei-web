import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { repositoryAccess } from "./authorization";
import { readTrust } from "./trust";
export async function mergeAuthorization(
  database: Prisma.TransactionClient,
  repositoryId: string,
  actorId: string,
) {
  const access = await repositoryAccess(database, repositoryId, actorId);
  if (access.repository.editScope === "ALL_USERS") {
    const trust = await readTrust(database, actorId);
    if (trust.score < trust.threshold) throw new Error("INSUFFICIENT_TRUST");
    return {
      authorizationKind: "GLOBAL_TRUST",
      accessVersion: access.repository.accessVersion,
      trustScore: trust.score,
      threshold: trust.threshold,
      ruleVersion: trust.ruleVersion,
    };
  }
  if (!access.canMergeInvited) throw new Error("FORBIDDEN");
  return {
    authorizationKind: "INVITED_PERMISSION",
    accessVersion: access.repository.accessVersion,
    trustScore: null,
    threshold: null,
    ruleVersion: null,
  };
}
