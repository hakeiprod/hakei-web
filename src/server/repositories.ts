import { verifyTransactionActor } from "./authentication/authorize";
import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { repositoryAccess } from "./authorization";
import { claimMutation, finishMutation } from "./idempotency";
const scopes = z
  .object({
    visibility: z.enum(["PRIVATE", "INVITED", "PUBLIC"]),
    editScope: z.enum(["INVITED", "ALL_USERS"]),
  })
  .refine(
    (value) => value.editScope !== "ALL_USERS" || value.visibility === "PUBLIC",
    "ALL_USERS requires PUBLIC visibility",
  );
export async function createRepository(
  database: PrismaClient,
  input: {
    actorId: string;
    name: string;
    visibility: "PRIVATE" | "INVITED" | "PUBLIC";
    editScope: "INVITED" | "ALL_USERS";
    key: string;
  },
) {
  const values = scopes.parse(input);
  const name = z.string().trim().min(1).max(200).parse(input.name);
  return database.$transaction(
    async (transaction) => {
      await verifyTransactionActor(transaction, input.actorId);
      await transaction.user.findUniqueOrThrow({
        where: { id: input.actorId },
      });
      const existing = await transaction.mutationReceipt.findUnique({
        where: {
          actorId_operation_key: {
            actorId: input.actorId,
            operation: "CREATE_REPOSITORY",
            key: input.key,
          },
        },
      });
      const receipt = await claimMutation(transaction, {
        actorId: input.actorId,
        operation: "CREATE_REPOSITORY",
        key: input.key,
        repositoryId: existing?.repositoryId ?? undefined,
        payload: { name, ...values },
      });
      if (receipt.status === "COMPLETED") return receipt.result;
      const repository = await transaction.scoreRepository.create({
        data: {
          name,
          ...values,
          ownerId: input.actorId,
          gitStorageKey: randomUUID(),
        },
      });
      await transaction.repositoryMember.create({
        data: {
          repositoryId: repository.id,
          userId: input.actorId,
          role: "ADMIN",
          canMerge: true,
        },
      });
      const result = { repositoryId: repository.id };
      await transaction.mutationReceipt.update({
        where: { id: receipt.id },
        data: { repositoryId: repository.id },
      });
      await finishMutation(transaction, receipt.id, result);
      return result;
    },
    { isolationLevel: "Serializable" },
  );
}
export async function updateRepository(
  database: PrismaClient,
  input: {
    actorId: string;
    repositoryId: string;
    expectedAccessVersion: number;
    visibility: "PRIVATE" | "INVITED" | "PUBLIC";
    editScope: "INVITED" | "ALL_USERS";
  },
) {
  const values = scopes.parse(input);
  return database.$transaction(
    async (transaction) => {
      await verifyTransactionActor(transaction, input.actorId);
      const access = await repositoryAccess(
        transaction,
        input.repositoryId,
        input.actorId,
      );
      if (!access.canManage) throw new Error("FORBIDDEN");
      const changed = await transaction.scoreRepository.updateMany({
        where: {
          id: input.repositoryId,
          accessVersion: input.expectedAccessVersion,
        },
        data: { ...values, accessVersion: { increment: 1 } },
      });
      if (changed.count !== 1) throw new Error("CONFLICT");
      await transaction.auditEvent.create({
        data: {
          actorId: input.actorId,
          entityType: "ScoreRepository",
          entityId: input.repositoryId,
          action: "UPDATE_SCOPE",
          before: {
            visibility: access.repository.visibility,
            editScope: access.repository.editScope,
          },
          after: values,
          reason: "Repository sharing updated",
        },
      });
      return { accessVersion: input.expectedAccessVersion + 1 };
    },
    { isolationLevel: "Serializable" },
  );
}
export async function setMember(
  database: PrismaClient,
  input: {
    actorId: string;
    repositoryId: string;
    userId: string;
    role: "ADMIN" | "EDITOR" | "VIEWER" | "REMOVE";
    canMerge: boolean;
    expectedAccessVersion: number;
  },
) {
  z.enum(["ADMIN", "EDITOR", "VIEWER", "REMOVE"]).parse(input.role);
  return database.$transaction(
    async (transaction) => {
      await verifyTransactionActor(transaction, input.actorId);
      const access = await repositoryAccess(
        transaction,
        input.repositoryId,
        input.actorId,
      );
      if (!access.canManage) throw new Error("FORBIDDEN");
      await transaction.user.findUniqueOrThrow({ where: { id: input.userId } });
      if (access.repository.ownerId === input.userId && input.role !== "ADMIN")
        throw new Error("OWNER_ADMIN_REQUIRED");
      const where = {
        repositoryId_userId: {
          repositoryId: input.repositoryId,
          userId: input.userId,
        },
      };
      const previous = await transaction.repositoryMember.findUnique({ where });
      const changed = await transaction.scoreRepository.updateMany({
        where: {
          id: input.repositoryId,
          accessVersion: input.expectedAccessVersion,
        },
        data: { accessVersion: { increment: 1 } },
      });
      if (changed.count !== 1) throw new Error("CONFLICT");
      await (input.role === "REMOVE"
        ? transaction.repositoryMember.deleteMany({
            where: { repositoryId: input.repositoryId, userId: input.userId },
          })
        : transaction.repositoryMember.upsert({
            where,
            create: {
              repositoryId: input.repositoryId,
              userId: input.userId,
              role: input.role,
              canMerge:
                input.role === "ADMIN" ||
                (input.role === "EDITOR" && input.canMerge),
            },
            update: {
              role: input.role,
              canMerge:
                input.role === "ADMIN" ||
                (input.role === "EDITOR" && input.canMerge),
            },
          }));
      await transaction.auditEvent.create({
        data: {
          actorId: input.actorId,
          entityType: "RepositoryMember",
          entityId: `${input.repositoryId}:${input.userId}`,
          action: "SET_MEMBER",
          before: {
            role: previous?.role ?? null,
            canMerge: previous?.canMerge ?? false,
          },
          after: { role: input.role, canMerge: input.canMerge },
          reason: "Repository membership updated",
        },
      });
      return { accessVersion: input.expectedAccessVersion + 1 };
    },
    { isolationLevel: "Serializable" },
  );
}
export async function listRepositories(
  database: PrismaClient,
  actorId?: string,
) {
  const memberships = actorId
    ? await database.repositoryMember.findMany({ where: { userId: actorId } })
    : [];
  const visible = [
    { visibility: "PUBLIC" },
    ...(actorId
      ? [
          { ownerId: actorId },
          {
            visibility: "INVITED",
            id: { in: memberships.map((member) => member.repositoryId) },
          },
          {
            visibility: "PRIVATE",
            id: {
              in: memberships
                .filter((member) => member.role === "ADMIN")
                .map((member) => member.repositoryId),
            },
          },
        ]
      : []),
  ];
  const repositories = await database.scoreRepository.findMany({
    where: { archivedAt: null, ownerId: { not: null }, OR: visible },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return Promise.all(
    repositories.map(async (repository) => {
      const access = await repositoryAccess(database, repository.id, actorId);
      return {
        id: repository.id,
        name: repository.name,
        visibility: repository.visibility,
        editScope: repository.editScope,
        accessVersion: repository.accessVersion,
        canEdit: access.canEdit,
        canManage: access.canManage,
        canMergeInvited: access.canMergeInvited,
      };
    }),
  );
}
