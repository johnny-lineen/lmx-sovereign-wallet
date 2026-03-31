-- CreateEnum
CREATE TYPE "UserActionStatus" AS ENUM ('todo', 'in_progress', 'done', 'skipped');

-- CreateEnum
CREATE TYPE "UserActionPriority" AS ENUM ('low', 'medium', 'high');

-- CreateTable
CREATE TABLE "UserAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "insightId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "UserActionStatus" NOT NULL DEFAULT 'todo',
    "priority" "UserActionPriority" NOT NULL DEFAULT 'medium',
    "relatedItemIds" TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "UserAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAction_userId_idx" ON "UserAction"("userId");

-- CreateIndex
CREATE INDEX "UserAction_userId_status_idx" ON "UserAction"("userId", "status");

-- CreateIndex
CREATE INDEX "UserAction_userId_priority_idx" ON "UserAction"("userId", "priority");

-- AddForeignKey
ALTER TABLE "UserAction" ADD CONSTRAINT "UserAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAction" ADD CONSTRAINT "UserAction_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "Insight"("id") ON DELETE SET NULL ON UPDATE CASCADE;
