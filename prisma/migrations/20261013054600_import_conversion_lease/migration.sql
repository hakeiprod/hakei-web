-- CreateTable
CREATE TABLE "ImportConversionLease" (
    "userId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportConversionLease_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImportConversionLease_leaseId_key" ON "ImportConversionLease"("leaseId");

-- CreateIndex
CREATE INDEX "ImportConversionLease_expiresAt_idx" ON "ImportConversionLease"("expiresAt");
