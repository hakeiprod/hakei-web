-- CreateTable
CREATE TABLE "EditProposal" (
    "id" TEXT NOT NULL,
    "scoreId" INTEGER NOT NULL,
    "baseRevisionId" TEXT NOT NULL,
    "baseRepositoryCommitOid" TEXT NOT NULL,
    "proposalCommitOid" TEXT NOT NULL,
    "proposalRef" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MergeRecord" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorizationKind" TEXT NOT NULL,
    "trustScore" DOUBLE PRECISION,
    "threshold" DOUBLE PRECISION,
    "ruleVersion" INTEGER,
    "accessVersion" INTEGER NOT NULL,

    CONSTRAINT "MergeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustRuleVersion" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "initialScore" DOUBLE PRECISION NOT NULL,
    "wAdmin" DOUBLE PRECISION NOT NULL,
    "wOutcome" DOUBLE PRECISION NOT NULL,
    "wReview" DOUBLE PRECISION NOT NULL,
    "acceptedDelta" DOUBLE PRECISION NOT NULL,
    "rejectedDelta" DOUBLE PRECISION NOT NULL,
    "reviewFactor" DOUBLE PRECISION NOT NULL,
    "minReview" DOUBLE PRECISION NOT NULL,
    "maxReview" DOUBLE PRECISION NOT NULL,
    "minScore" DOUBLE PRECISION NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "mergeThreshold" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "operatorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustRuleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustPolicyState" (
    "singletonId" TEXT NOT NULL,
    "activeRuleId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TrustPolicyState_pkey" PRIMARY KEY ("singletonId")
);

-- CreateTable
CREATE TABLE "TrustEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTrustReview" (
    "id" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTrustReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTrustState" (
    "userId" TEXT NOT NULL,
    "inputVersion" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserTrustState_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "TrustSnapshot" (
    "userId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "inputVersion" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustSnapshot_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "EditProposal_scoreId_status_idx" ON "EditProposal"("scoreId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MergeRecord_proposalId_key" ON "MergeRecord"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "MergeRecord_revisionId_key" ON "MergeRecord"("revisionId");

-- CreateIndex
CREATE UNIQUE INDEX "TrustRuleVersion_version_key" ON "TrustRuleVersion"("version");

-- CreateIndex
CREATE UNIQUE INDEX "TrustEvent_sourceId_key" ON "TrustEvent"("sourceId");

-- CreateIndex
CREATE INDEX "TrustEvent_userId_type_idx" ON "TrustEvent"("userId", "type");

-- CreateIndex
CREATE INDEX "UserTrustReview_targetId_idx" ON "UserTrustReview"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTrustReview_reviewerId_targetId_key" ON "UserTrustReview"("reviewerId", "targetId");

