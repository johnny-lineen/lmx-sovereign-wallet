-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('queued', 'running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "ImportCandidateStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "ImportCandidateSignal" AS ENUM (
  'welcome_account',
  'security_alert',
  'password_reset',
  'receipt_invoice',
  'subscription_renewal',
  'account_activity'
);

-- CreateTable
CREATE TABLE "GmailConnector" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gmailAddress" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailConnector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gmailConnectorId" TEXT NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'queued',
    "profileEmailItemId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "metadata" JSONB,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportCandidate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "status" "ImportCandidateStatus" NOT NULL DEFAULT 'pending',
    "signal" "ImportCandidateSignal" NOT NULL,
    "suggestedType" "VaultItemType" NOT NULL,
    "title" TEXT NOT NULL,
    "provider" TEXT,
    "providerDomain" TEXT,
    "evidence" JSONB NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "createdVaultItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GmailConnector_userId_gmailAddress_key" ON "GmailConnector"("userId", "gmailAddress");

CREATE INDEX "GmailConnector_userId_idx" ON "GmailConnector"("userId");

CREATE INDEX "ImportJob_userId_idx" ON "ImportJob"("userId");

CREATE INDEX "ImportJob_userId_status_idx" ON "ImportJob"("userId", "status");

CREATE INDEX "ImportJob_gmailConnectorId_idx" ON "ImportJob"("gmailConnectorId");

CREATE UNIQUE INDEX "ImportCandidate_userId_dedupeKey_key" ON "ImportCandidate"("userId", "dedupeKey");

CREATE INDEX "ImportCandidate_userId_status_idx" ON "ImportCandidate"("userId", "status");

CREATE INDEX "ImportCandidate_importJobId_idx" ON "ImportCandidate"("importJobId");

-- AddForeignKey
ALTER TABLE "GmailConnector" ADD CONSTRAINT "GmailConnector_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_gmailConnectorId_fkey" FOREIGN KEY ("gmailConnectorId") REFERENCES "GmailConnector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_profileEmailItemId_fkey" FOREIGN KEY ("profileEmailItemId") REFERENCES "VaultItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ImportCandidate" ADD CONSTRAINT "ImportCandidate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImportCandidate" ADD CONSTRAINT "ImportCandidate_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImportCandidate" ADD CONSTRAINT "ImportCandidate_createdVaultItemId_fkey" FOREIGN KEY ("createdVaultItemId") REFERENCES "VaultItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
