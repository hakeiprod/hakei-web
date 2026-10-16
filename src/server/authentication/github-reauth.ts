import "server-only";
import type { PrismaClient } from "../../generated/prisma/client";
import { providerAvailability } from "./providers";
import { createSessionInTransaction, lockSession } from "./sessions";
import { databaseNow } from "./rate-limit";
type Environment = Readonly<Record<string, string | undefined>>;
export type GithubActor = { sub: string; sid: string; authVersion: number };
function enabled(environment: Environment) {
  if (!providerAvailability(environment).github)
    throw new Error("AUTH_METHOD_UNAVAILABLE");
}
export async function beginGithubReauth(
  database: PrismaClient,
  actor: GithubActor,
  environment: Environment,
) {
  enabled(environment);
  return database.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${actor.sub} FOR UPDATE`;
    await lockSession(tx, actor);
    const account = await tx.account.findFirst({
      where: { userId: actor.sub, provider: "github" },
    });
    if (!account) throw new Error("AUTH_METHOD_UNAVAILABLE");
    const now = await databaseNow(tx);
    await tx.reauthIntent.updateMany({
      where: { userId: actor.sub, currentSid: actor.sid, revokedAt: null },
      data: { revokedAt: now },
    });
    enabled(environment);
    await tx.reauthIntent.create({
      data: {
        userId: actor.sub,
        originSid: actor.sid,
        currentSid: actor.sid,
        authVersion: actor.authVersion,
        providerAccountId: account.providerAccountId,
        requestedAt: now,
        expiresAt: new Date(now.getTime() + 15 * 60_000),
      },
    });
    return {
      code: "REAUTHENTICATION_STARTED",
      message: "GitHubで本人確認を行ってください。",
    };
  });
}
export async function githubSession(
  database: PrismaClient,
  userId: string,
  providerAccountId: string,
  incoming: GithubActor | undefined,
  environment: Environment,
) {
  enabled(environment);
  return database.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const account = await tx.account.findUnique({
      where: {
        provider_providerAccountId: { provider: "github", providerAccountId },
      },
    });
    if (account?.userId !== userId || (incoming && incoming.sub !== userId))
      throw new Error("UNAUTHENTICATED");
    if (incoming) await lockSession(tx, incoming);
    const proof = incoming
      ? await tx.reauthIntent.findFirst({
          where: {
            userId,
            originSid: incoming.sid,
            revokedAt: null,
            consumedAt: null,
          },
          orderBy: { requestedAt: "desc" },
        })
      : null;
    const now = await databaseNow(tx);
    if (
      proof &&
      (proof.completedAt ||
        proof.expiresAt <= now ||
        proof.authVersion !== incoming?.authVersion ||
        proof.providerAccountId !== providerAccountId)
    )
      throw new Error("REAUTHENTICATION_REQUIRED");
    enabled(environment);
    const session = await createSessionInTransaction(tx, {
      userId,
      authVersion: user.authVersion,
      method: "github",
    });
    if (proof && incoming) {
      await tx.reauthIntent.update({
        where: { id: proof.id },
        data: {
          currentSid: session.sid,
          completedAt: now,
          expiresAt: new Date(now.getTime() + 15 * 60_000),
        },
      });
      await tx.authSessionRecord.update({
        where: { sid: incoming.sid },
        data: { revokedAt: now },
      });
    }
    return session;
  });
}
