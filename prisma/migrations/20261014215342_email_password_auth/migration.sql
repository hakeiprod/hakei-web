-- AlterTable
ALTER TABLE "users" ADD COLUMN     "authVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "EmailIdentity" (
    "id" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "userId" TEXT,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordCredential" (
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordCredential_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "AuthChallengeHead" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AuthChallengeHead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthChallenge" (
    "id" TEXT NOT NULL,
    "headId" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "tokenDigest" TEXT NOT NULL,
    "userId" TEXT,
    "emailSnapshot" TEXT NOT NULL,
    "authVersion" INTEGER,
    "issuerSid" TEXT,
    "reauthIntentId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "sendStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSessionRecord" (
    "sid" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authVersion" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AuthSessionRecord_pkey" PRIMARY KEY ("sid")
);

-- CreateTable
CREATE TABLE "ReauthIntent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originSid" TEXT NOT NULL,
    "currentSid" TEXT NOT NULL,
    "authVersion" INTEGER NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ReauthIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthRateWindow" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "keyDigest" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "limitSnapshot" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AuthRateWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthAttempt" (
    "id" TEXT NOT NULL,
    "mailboxWindowId" TEXT NOT NULL,
    "sourceWindowId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "deadline" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthChangeEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" TEXT NOT NULL,

    CONSTRAINT "AuthChangeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthNotice" (
    "eventId" TEXT NOT NULL,
    "recipientSnapshot" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthNotice_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "OAuthCreationReceipt" (
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthCreationReceipt_pkey" PRIMARY KEY ("provider","providerAccountId")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailIdentity_normalizedEmail_key" ON "EmailIdentity"("normalizedEmail");

-- CreateIndex
CREATE UNIQUE INDEX "EmailIdentity_userId_key" ON "EmailIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthChallengeHead_identityId_purpose_key" ON "AuthChallengeHead"("identityId", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "AuthChallenge_tokenDigest_key" ON "AuthChallenge"("tokenDigest");

-- CreateIndex
CREATE INDEX "AuthChallenge_userId_idx" ON "AuthChallenge"("userId");

-- CreateIndex
CREATE INDEX "AuthChallenge_expiresAt_idx" ON "AuthChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthSessionRecord_userId_authVersion_idx" ON "AuthSessionRecord"("userId", "authVersion");

-- CreateIndex
CREATE INDEX "AuthSessionRecord_expiresAt_idx" ON "AuthSessionRecord"("expiresAt");

-- CreateIndex
CREATE INDEX "ReauthIntent_userId_currentSid_idx" ON "ReauthIntent"("userId", "currentSid");

-- CreateIndex
CREATE INDEX "ReauthIntent_expiresAt_idx" ON "ReauthIntent"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthRateWindow_windowEnd_idx" ON "AuthRateWindow"("windowEnd");

-- CreateIndex
CREATE UNIQUE INDEX "AuthRateWindow_kind_keyDigest_windowStart_key" ON "AuthRateWindow"("kind", "keyDigest", "windowStart");

-- CreateIndex
CREATE INDEX "AuthAttempt_status_deadline_idx" ON "AuthAttempt"("status", "deadline");

-- CreateIndex
CREATE INDEX "AuthNotice_status_nextAttemptAt_idx" ON "AuthNotice"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "OAuthCreationReceipt_userId_idx" ON "OAuthCreationReceipt"("userId");

-- AddForeignKey
ALTER TABLE "EmailIdentity" ADD CONSTRAINT "EmailIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordCredential" ADD CONSTRAINT "PasswordCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthChallengeHead" ADD CONSTRAINT "AuthChallengeHead_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "EmailIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthChallenge" ADD CONSTRAINT "AuthChallenge_headId_fkey" FOREIGN KEY ("headId") REFERENCES "AuthChallengeHead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSessionRecord" ADD CONSTRAINT "AuthSessionRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReauthIntent" ADD CONSTRAINT "ReauthIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthAttempt" ADD CONSTRAINT "AuthAttempt_mailboxWindowId_fkey" FOREIGN KEY ("mailboxWindowId") REFERENCES "AuthRateWindow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthAttempt" ADD CONSTRAINT "AuthAttempt_sourceWindowId_fkey" FOREIGN KEY ("sourceWindowId") REFERENCES "AuthRateWindow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthChangeEvent" ADD CONSTRAINT "AuthChangeEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthNotice" ADD CONSTRAINT "AuthNotice_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "AuthChangeEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthCreationReceipt" ADD CONSTRAINT "OAuthCreationReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
