import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
export const operationLeaseMs = 30_000;
export async function leaseOperation(
  database: Pick<Prisma.TransactionClient, "mutationReceipt">,
  id: string,
) {
  const owner = randomUUID();
  const now = new Date();
  const updated = await database.mutationReceipt.updateMany({
    where: { id, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
    data: {
      leaseOwner: owner,
      leaseUntil: new Date(now.getTime() + operationLeaseMs),
    },
  });
  if (updated.count !== 1) throw new Error("IN_PROGRESS");
  return owner;
}
export async function releaseOperation(
  database: Pick<Prisma.TransactionClient, "mutationReceipt">,
  id: string,
  owner: string,
) {
  await database.mutationReceipt.updateMany({
    where: { id, leaseOwner: owner },
    data: { leaseOwner: null, leaseUntil: null },
  });
}
