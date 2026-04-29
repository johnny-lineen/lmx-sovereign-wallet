-- CreateEnum
CREATE TYPE "PublicAuditRunStatus" AS ENUM ('queued', 'running', 'awaiting_review', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "PublicAuditCandidateStatus" AS ENUM ('pending', 'auto_imported', 'accepted', 'rejected', 'ignored', 'linked_existing');

-- CreateEnum
CREATE TYPE "PublicAuditConfidenceBand" AS ENUM ('high', 'medium', 'low');

-- CreateTable
CREATE TABLE "PublicAuditRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "submittedEmail" TEXT NOT NULL,
    "usernamesJson" JSONB,
    "locationHint" TEXT,
    "websiteHint" TEXT,
    "notes" TEXT,
    "status" "PublicAuditRunStatus" NOT NULL DEFAULT 'queued',
    "totalCandidates" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicAuditRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicAuditCandidate" (
    "id" TEXT NOT NULL,
    "auditRunId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "proposedVaultType" "VaultItemType" NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "snippet" TEXT,
    "matchedIdentifier" TEXT,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "confidenceBand" "PublicAuditConfidenceBand" NOT NULL,
    "status" "PublicAuditCandidateStatus" NOT NULL DEFAULT 'pending',
    "rawData" JSONB,
    "createdVaultItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicAuditCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicAuditRun_userId_createdAt_idx" ON "PublicAuditRun"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PublicAuditCandidate_userId_status_idx" ON "PublicAuditCandidate"("userId", "status");

-- CreateIndex
CREATE INDEX "PublicAuditCandidate_auditRunId_idx" ON "PublicAuditCandidate"("auditRunId");

-- AddForeignKey
ALTER TABLE "PublicAuditRun" ADD CONSTRAINT "PublicAuditRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicAuditCandidate" ADD CONSTRAINT "PublicAuditCandidate_auditRunId_fkey" FOREIGN KEY ("auditRunId") REFERENCES "PublicAuditRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicAuditCandidate" ADD CONSTRAINT "PublicAuditCandidate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicAuditCandidate" ADD CONSTRAINT "PublicAuditCandidate_createdVaultItemId_fkey" FOREIGN KEY ("createdVaultItemId") REFERENCES "VaultItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
