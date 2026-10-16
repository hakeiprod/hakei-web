-- CreateTable
CREATE TABLE "EvaluationRuleVersion" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "practiceWindowUs" INTEGER NOT NULL,
    "perfectWindowUs" INTEGER NOT NULL,
    "goodWindowUs" INTEGER NOT NULL,
    "weights" JSONB NOT NULL,
    "extraPenalty" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationRuleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientSessionId" TEXT NOT NULL,
    "scoreRevisionId" TEXT NOT NULL,
    "trackId" INTEGER NOT NULL,
    "rangeStartBar" INTEGER NOT NULL,
    "rangeEndBar" INTEGER NOT NULL,
    "tempoScale" DOUBLE PRECISION NOT NULL,
    "calibrationUs" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "ruleId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endedUs" INTEGER,
    "deviceLabel" TEXT,
    "comparisonKey" TEXT NOT NULL,
    "submissionHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceEventBatch" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "batchIndex" INTEGER NOT NULL,
    "events" JSONB NOT NULL,
    "checksum" TEXT NOT NULL,

    CONSTRAINT "PerformanceEventBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationResult" (
    "sessionId" TEXT NOT NULL,
    "algorithmVersion" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "perNote" JSONB NOT NULL,
    "perBar" JSONB NOT NULL,
    "score" DOUBLE PRECISION,
    "meanAbsTimingUs" DOUBLE PRECISION,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationResult_pkey" PRIMARY KEY ("sessionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationRuleVersion_version_key" ON "EvaluationRuleVersion"("version");

-- CreateIndex
CREATE INDEX "PracticeSession_userId_comparisonKey_status_startedAt_idx" ON "PracticeSession"("userId", "comparisonKey", "status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PracticeSession_userId_clientSessionId_key" ON "PracticeSession"("userId", "clientSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceEventBatch_sessionId_batchIndex_key" ON "PerformanceEventBatch"("sessionId", "batchIndex");

-- AddForeignKey
ALTER TABLE "PracticeSession" ADD CONSTRAINT "PracticeSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeSession" ADD CONSTRAINT "PracticeSession_scoreRevisionId_fkey" FOREIGN KEY ("scoreRevisionId") REFERENCES "ScoreRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeSession" ADD CONSTRAINT "PracticeSession_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "EvaluationRuleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceEventBatch" ADD CONSTRAINT "PerformanceEventBatch_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PracticeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationResult" ADD CONSTRAINT "EvaluationResult_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PracticeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
