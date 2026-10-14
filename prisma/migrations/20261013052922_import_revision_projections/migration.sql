-- CreateTable
CREATE TABLE "ImportMetadata" (
    "revisionId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "formatVersion" TEXT NOT NULL,
    "converterVersion" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "grid" TEXT,
    "sourceName" TEXT,
    "warningAcknowledgedAt" TIMESTAMP(3),

    CONSTRAINT "ImportMetadata_pkey" PRIMARY KEY ("revisionId")
);

-- CreateTable
CREATE TABLE "ConversionIssue" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "fieldPath" TEXT,
    "bar" INTEGER,
    "track" INTEGER,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "ConversionIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevisionValidation" (
    "revisionId" TEXT NOT NULL,
    "validatorVersion" TEXT NOT NULL,
    "canPractice" BOOLEAN NOT NULL,
    "canGame" BOOLEAN NOT NULL,
    "unresolvedIssueIds" TEXT[],

    CONSTRAINT "RevisionValidation_pkey" PRIMARY KEY ("revisionId")
);

-- CreateIndex
CREATE INDEX "ConversionIssue_revisionId_severity_status_idx" ON "ConversionIssue"("revisionId", "severity", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ConversionIssue_revisionId_issueId_key" ON "ConversionIssue"("revisionId", "issueId");
