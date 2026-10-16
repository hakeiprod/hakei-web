import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { mutationKeySchema, payloadHash } from "./contracts";
type ReceiptDatabase = Pick<Prisma.TransactionClient, "mutationReceipt">;
export type MutationInput = {
  actorId: string;
  operation: string;
  key: string;
  repositoryId?: string;
  payload: unknown;
  scoreId?: number;
  proposalId?: string;
  expectedRepositoryOid?: string;
  expectedRevisionId?: string;
};
export async function claimMutation(
  database: ReceiptDatabase,
  input: MutationInput,
) {
  mutationKeySchema.parse(input.key);
  const hash = payloadHash(input.payload);
  const inserted = await database.mutationReceipt.createMany({
    skipDuplicates: true,
    data: [
      {
        id: randomUUID(),
        actorId: input.actorId,
        operation: input.operation,
        key: input.key,
        repositoryId: input.repositoryId,
        payloadHash: hash,
        scoreId: input.scoreId,
        proposalId: input.proposalId,
        expectedRepositoryOid: input.expectedRepositoryOid,
        expectedRevisionId: input.expectedRevisionId,
      },
    ],
  });
  const receipt = await database.mutationReceipt.findUniqueOrThrow({
    where: {
      actorId_operation_key: {
        actorId: input.actorId,
        operation: input.operation,
        key: input.key,
      },
    },
  });
  if (
    receipt.payloadHash !== hash ||
    receipt.repositoryId !== (input.repositoryId ?? null)
  )
    throw new Error("CONFLICT");
  return { ...receipt, acquired: inserted.count === 1 };
}
/** Must use the same transaction as the business update. Completed receipts remain as tombstones. */
export async function finishMutation(
  database: ReceiptDatabase,
  id: string,
  result: Prisma.InputJsonValue,
) {
  return database.mutationReceipt.update({
    where: { id },
    data: { result, status: "COMPLETED", stage: "DB_APPLIED" },
  });
}
