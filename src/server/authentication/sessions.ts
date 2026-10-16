import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { PrismaClient, Prisma } from "../../generated/prisma/client";
import { databaseNow } from "./rate-limit";

const tokenSchema = z.object({
  sub: z.string().min(1),
  sid: z.string().min(1),
  authVersion: z.number().int().nonnegative(),
});
type SessionToken = z.infer<typeof tokenSchema>;
type NewSession = {
  userId: string;
  authVersion: number;
  method: "credentials" | "github";
  credentialVersion?: number;
};

export async function lockSession(
  tx: Prisma.TransactionClient,
  input: SessionToken,
) {
  const token = tokenSchema.parse(input);
  await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${token.sub} FOR SHARE`;
  await tx.$queryRaw`SELECT "sid" FROM "AuthSessionRecord" WHERE "sid" = ${token.sid} FOR SHARE`;
  const user = await tx.user.findUnique({
    where: { id: token.sub },
    select: { id: true, serviceRole: true, authVersion: true },
  });
  const session = await tx.authSessionRecord.findUnique({
    where: { sid: token.sid },
  });
  const now = await databaseNow(tx);
  if (
    !user ||
    !session ||
    session.userId !== user.id ||
    session.authVersion !== token.authVersion ||
    user.authVersion !== token.authVersion ||
    session.revokedAt ||
    session.expiresAt <= now
  )
    throw new Error("UNAUTHENTICATED");
  return { ...user, sid: token.sid };
}
export async function validateSessionStrict(
  database: PrismaClient,
  input: unknown,
) {
  const token = tokenSchema.safeParse(input);
  if (!token.success) return null;
  try {
    return await database.$transaction((tx) => lockSession(tx, token.data));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED")
      return null;
    throw error;
  }
}
export async function validateSession(database: PrismaClient, input: unknown) {
  try {
    return await validateSessionStrict(database, input);
  } catch {
    return null;
  }
}
export function createSession(database: PrismaClient, input: NewSession) {
  return database.$transaction((tx) => createSessionInTransaction(tx, input));
}
export async function createSessionInTransaction(
  tx: Prisma.TransactionClient,
  input: NewSession,
) {
  await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${input.userId} FOR SHARE`;
  const user = await tx.user.findUnique({
    where: { id: input.userId },
    select: { authVersion: true },
  });
  if (!user || user.authVersion !== input.authVersion)
    throw new Error("UNAUTHENTICATED");
  if (input.method === "credentials") {
    const credential = await tx.passwordCredential.findUnique({
      where: { userId: input.userId },
    });
    if (!credential || credential.version !== input.credentialVersion)
      throw new Error("UNAUTHENTICATED");
  }
  const now = await databaseNow(tx);
  return tx.authSessionRecord.create({
    data: {
      sid: randomBytes(32).toString("base64url"),
      userId: input.userId,
      authVersion: input.authVersion,
      method: input.method,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60_000),
    },
  });
}
export function revokeSession(database: PrismaClient, sid: string) {
  return database.$transaction(async (tx) => {
    const snapshot = await tx.authSessionRecord.findUnique({ where: { sid } });
    if (!snapshot) return;
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${snapshot.userId} FOR UPDATE`;
    await tx.authSessionRecord.updateMany({
      where: { sid, revokedAt: null },
      data: { revokedAt: await databaseNow(tx) },
    });
  });
}
export async function revokeAllSessions(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
  const now = await databaseNow(tx);
  const user = await tx.user.update({
    where: { id: userId },
    data: { authVersion: { increment: 1 } },
  });
  await tx.authSessionRecord.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now },
  });
  await tx.authChallenge.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now },
  });
  await tx.reauthIntent.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now },
  });
  return user;
}
