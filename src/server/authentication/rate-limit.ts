import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import type { PrismaClient, Prisma } from "../../generated/prisma/client";

type ReservationInput = {
  mailbox: string;
  source: string;
  secret: string;
  mailboxLimit: number;
  sourceLimit: number;
};
export async function databaseNow(tx: Prisma.TransactionClient) {
  const [row] = await tx.$queryRaw<
    { now: Date }[]
  >`SELECT clock_timestamp() AS now`;
  return row.now;
}
export function requestSource(headers: Headers, trustedProxy: boolean) {
  const value = trustedProxy ? headers.get("x-auth-client-ip") : null;
  if (!value || !isIP(value)) return "unknown";
  return isIP(value) === 6
    ? new URL(`http://[${value}]/`).hostname.toLowerCase()
    : value;
}
async function lockWindows(
  tx: Prisma.TransactionClient,
  purpose: "login" | "send",
  input: ReservationInput,
) {
  if (
    input.secret.length < 32 ||
    !Number.isSafeInteger(input.mailboxLimit) ||
    input.mailboxLimit < 1 ||
    !Number.isSafeInteger(input.sourceLimit) ||
    input.sourceLimit < 1
  )
    throw new Error("RETRY_LATER");
  const now = await databaseNow(tx);
  const duration = purpose === "login" ? 15 * 60_000 : 60 * 60_000;
  const start = new Date(Math.floor(now.getTime() / duration) * duration);
  const end = new Date(start.getTime() + duration);
  const windows = [];
  for (const item of [
    {
      kind: `${purpose}:mailbox`,
      value: input.mailbox,
      limit: input.mailboxLimit,
    },
    {
      kind: `${purpose}:source`,
      value: input.source,
      limit: input.sourceLimit,
    },
  ]) {
    const digest = createHmac("sha256", input.secret)
      .update(item.kind)
      .update("\0")
      .update(item.value)
      .digest("hex");
    const id = randomUUID();
    await tx.$executeRaw`INSERT INTO "AuthRateWindow" ("id", "kind", "keyDigest", "windowStart", "windowEnd", "limitSnapshot", "count") VALUES (${id}, ${item.kind}, ${digest}, ${start}, ${end}, ${item.limit}, 0) ON CONFLICT ("kind", "keyDigest", "windowStart") DO NOTHING`;
    await tx.$queryRaw`SELECT "id" FROM "AuthRateWindow" WHERE "kind" = ${item.kind} AND "keyDigest" = ${digest} AND "windowStart" = ${start} FOR UPDATE`;
    windows.push(
      await tx.authRateWindow.findUniqueOrThrow({
        where: {
          kind_keyDigest_windowStart: {
            kind: item.kind,
            keyDigest: digest,
            windowStart: start,
          },
        },
      }),
    );
  }
  const current = await databaseNow(tx);
  if (
    current >= end ||
    windows.some((window) => window.count >= window.limitSnapshot)
  )
    throw new Error("RETRY_LATER");
  return { windows, now: current };
}
export function reserveLogin(database: PrismaClient, input: ReservationInput) {
  return database.$transaction(async (tx) => {
    const { windows, now } = await lockWindows(tx, "login", input);
    await tx.authAttempt.updateMany({
      where: {
        status: "PENDING",
        deadline: { lte: now },
        OR: [
          { mailboxWindowId: windows[0].id },
          { sourceWindowId: windows[1].id },
        ],
      },
      data: { status: "FAILED" },
    });
    for (const window of windows)
      await tx.authRateWindow.update({
        where: { id: window.id },
        data: { count: { increment: 1 } },
      });
    return tx.authAttempt.create({
      data: {
        mailboxWindowId: windows[0].id,
        sourceWindowId: windows[1].id,
        deadline: new Date(now.getTime() + 10_000),
      },
    });
  });
}
export function finishLogin(
  database: PrismaClient,
  id: string,
  success: boolean,
) {
  return database.$transaction(async (tx) => {
    const snapshot = await tx.authAttempt.findUnique({ where: { id } });
    if (!snapshot) return false;
    const windows = await tx.authRateWindow.findMany({
      where: {
        id: { in: [snapshot.mailboxWindowId, snapshot.sourceWindowId] },
      },
      orderBy: { kind: "asc" },
    });
    for (const window of windows)
      await tx.$queryRaw`SELECT "id" FROM "AuthRateWindow" WHERE "id" = ${window.id} FOR UPDATE`;
    const now = await databaseNow(tx);
    const accepted = success && snapshot.deadline > now;
    const changed = await tx.authAttempt.updateMany({
      where: { id, status: "PENDING" },
      data: { status: accepted ? "SUCCEEDED" : "FAILED" },
    });
    if (accepted && changed.count === 1)
      for (const window of windows)
        await tx.authRateWindow.update({
          where: { id: window.id },
          data: { count: { decrement: 1 } },
        });
    return accepted && changed.count === 1;
  });
}
export function reserveSend(database: PrismaClient, input: ReservationInput) {
  return database.$transaction(async (tx) => {
    const { windows } = await lockWindows(tx, "send", input);
    for (const window of windows)
      await tx.authRateWindow.update({
        where: { id: window.id },
        data: { count: { increment: 1 } },
      });
  });
}
