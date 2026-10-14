-- AlterTable
ALTER TABLE "users" ADD COLUMN     "serviceRole" TEXT NOT NULL DEFAULT 'USER';

-- AlterTable
ALTER TABLE "Score" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "currentRevisionId" TEXT,
ADD COLUMN     "repositoryId" TEXT,
ALTER COLUMN "data" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ScoreRepository" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "editScope" TEXT NOT NULL DEFAULT 'INVITED',
    "accessVersion" INTEGER NOT NULL DEFAULT 0,
    "gitStorageKey" TEXT NOT NULL,
    "acceptedCommitOid" TEXT,
    "acceptedGeneration" INTEGER NOT NULL DEFAULT 0,
    "syncState" TEXT NOT NULL DEFAULT 'READY',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreRepository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepositoryMember" (
    "repositoryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "canMerge" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RepositoryMember_pkey" PRIMARY KEY ("repositoryId","userId")
);

-- CreateTable
CREATE TABLE "ScoreRevision" (
    "id" TEXT NOT NULL,
    "scoreId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "commitOid" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "dataHash" TEXT NOT NULL,
    "dataFormatVersion" TEXT NOT NULL,
    "authorId" TEXT,
    "proposalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MutationReceipt" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "scoreId" INTEGER,
    "proposalId" TEXT,
    "expectedRepositoryOid" TEXT,
    "expectedRevisionId" TEXT,
    "preparedCommitOid" TEXT,
    "preparedRef" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'CLAIMED',
    "status" TEXT NOT NULL DEFAULT 'PREPARING',
    "result" JSONB,
    "leaseOwner" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MutationReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitPublicationJob" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "expectedOldOid" TEXT,
    "targetOid" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GitPublicationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScoreRepository_gitStorageKey_key" ON "ScoreRepository"("gitStorageKey");

-- CreateIndex
CREATE INDEX "ScoreRevision_repositoryId_commitOid_idx" ON "ScoreRevision"("repositoryId", "commitOid");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreRevision_scoreId_number_key" ON "ScoreRevision"("scoreId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "MutationReceipt_actorId_operation_key_key" ON "MutationReceipt"("actorId", "operation", "key");

-- CreateIndex
CREATE UNIQUE INDEX "GitPublicationJob_operationId_key" ON "GitPublicationJob"("operationId");

-- CreateIndex
CREATE INDEX "Score_repositoryId_idx" ON "Score"("repositoryId");

