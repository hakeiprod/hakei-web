import "server-only";
import { Worker } from "node:worker_threads";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { PrismaClient } from "@/generated/prisma/client";
import { z } from "zod";
import {
  importCandidateSchema,
  conversionIssueSchema,
  importMetadataSchema,
  revisionValidationSchema,
} from "@/s-core/models/import/contracts";
import type { ConversionInput } from "@/s-core/models/import/convert";
import { importLimits } from "./import-limits";
const resultSchema = z
  .object({
    candidate: importCandidateSchema,
    issues: z.array(conversionIssueSchema),
    metadata: importMetadataSchema,
    validation: revisionValidationSchema,
    canPractice: z.boolean(),
    canGame: z.boolean(),
    changedNoteCount: z.int().nonnegative().optional(),
    changes: z
      .array(
        z.object({
          noteId: z.string(),
          onsetDelta: z.number().finite(),
          durationDelta: z.number().finite(),
        }),
      )
      .optional(),
  })
  .strict();
export async function acquireImportLease(
  database: PrismaClient,
  userId: string,
) {
  const leaseId = randomUUID();
  const maximum = importLimits().maxConcurrentWorkers;
  return database.$transaction(async (transaction) => {
    // A short PostgreSQL advisory lock serializes admission across server instances.
    // It is released by transaction completion; conversion runs outside the transaction.
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(90358234)::text`;
    const now = new Date();
    await transaction.importConversionLease.deleteMany({
      where: { expiresAt: { lte: now } },
    });
    if (
      await transaction.importConversionLease.findUnique({ where: { userId } })
    )
      throw new Error("IMPORT_BUSY");
    if ((await transaction.importConversionLease.count()) >= maximum)
      throw new Error("IMPORT_RESOURCE_BUSY");
    await transaction.importConversionLease.create({
      data: { userId, leaseId, expiresAt: new Date(now.getTime() + 15_000) },
    });
    return leaseId;
  });
}
export async function releaseImportLease(
  database: PrismaClient,
  userId: string,
  leaseId: string,
) {
  await database.importConversionLease.deleteMany({
    where: { userId, leaseId },
  });
}
export async function runImportWorker(
  input: ConversionInput,
  signal?: AbortSignal,
) {
  const limits = importLimits();
  if (input.bytes.byteLength > limits.maxInputBytes)
    throw new Error("INPUT_LIMIT");
  if (signal?.aborted) throw new Error("IMPORT_ABORTED");
  const copy = new Uint8Array(input.bytes);
  const worker = new Worker(
    path.join(process.cwd(), "dist/import-worker.mjs"),
    {
      workerData: { ...input, bytes: copy },
      transferList: [copy.buffer],
      execArgv: [],
      resourceLimits: {
        maxOldGenerationSizeMb: limits.workerHeapMb,
        maxYoungGenerationSizeMb: 32,
        stackSizeMb: 4,
      },
      stdout: true,
      stderr: true,
    },
  );
  // Consume worker streams without exposing untrusted file contents or library error messages.
  worker.stdout.resume();
  worker.stderr.resume();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  try {
    return await new Promise<z.infer<typeof resultSchema>>(
      (resolve, reject) => {
        let settled = false;
        const fail = (code: string) => {
          if (!settled) {
            settled = true;
            reject(new Error(code));
          }
        };
        abort = () => fail("IMPORT_ABORTED");
        signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted) {
          abort();
          return;
        }
        timer = setTimeout(() => fail("IMPORT_TIMEOUT"), limits.timeoutMs);
        worker.once("error", () => fail("IMPORT_RESOURCE_FAILURE"));
        worker.once("exit", () => fail("IMPORT_RESOURCE_FAILURE"));
        worker.once("message", (response: unknown) => {
          if (settled) return;
          const envelope = z
            .union([
              z.object({ ok: z.literal(true), result: resultSchema }).strict(),
              z
                .object({
                  ok: z.literal(false),
                  code: z.string().regex(/^[A-Z0-9_]{1,80}$/),
                })
                .strict(),
            ])
            .safeParse(response);
          if (!envelope.success) {
            fail("IMPORT_RESOURCE_FAILURE");
            return;
          }
          if (!envelope.data.ok) {
            fail(envelope.data.code);
            return;
          }
          settled = true;
          resolve(envelope.data.result);
        });
      },
    );
  } finally {
    if (timer) clearTimeout(timer);
    if (abort) signal?.removeEventListener("abort", abort);
    await worker.terminate();
  }
}
export async function processImportRequest<T>(
  database: PrismaClient,
  actorId: string,
  handler: (
    convert: (input: ConversionInput) => Promise<z.infer<typeof resultSchema>>,
  ) => Promise<T>,
  signal?: AbortSignal,
) {
  const lease = await acquireImportLease(database, actorId);
  try {
    return await handler(async (input) => {
      const renewed = await database.importConversionLease.updateMany({
        where: {
          userId: actorId,
          leaseId: lease,
          expiresAt: { gt: new Date() },
        },
        data: { expiresAt: new Date(Date.now() + 15_000) },
      });
      if (renewed.count !== 1) throw new Error("IMPORT_BUSY");
      return runImportWorker(input, signal);
    });
  } finally {
    await releaseImportLease(database, actorId, lease);
  }
}
export async function previewConversion(
  database: PrismaClient,
  actorId: string,
  input: ConversionInput,
  signal?: AbortSignal,
) {
  return processImportRequest(
    database,
    actorId,
    (convert) => convert(input),
    signal,
  );
}
