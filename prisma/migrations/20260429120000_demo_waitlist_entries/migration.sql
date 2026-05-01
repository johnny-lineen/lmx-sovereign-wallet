-- CreateEnum
CREATE TYPE "DemoFootprintGoal" AS ENUM ('privacy', 'security', 'accounts', 'data_exposure', 'just_curious');

-- CreateEnum
CREATE TYPE "DemoAccountCountEstimate" AS ENUM ('range_0_25', 'range_25_75', 'range_75_plus');

-- CreateTable
CREATE TABLE "DemoWaitlistEntry" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "digitalFootprintGoal" "DemoFootprintGoal" NOT NULL,
    "accountCountEstimate" "DemoAccountCountEstimate" NOT NULL,
    "usefulnessNotes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'landing_modal',
    "clerkUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoWaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DemoWaitlistEntry_email_source_key" ON "DemoWaitlistEntry"("email", "source");

-- CreateIndex
CREATE INDEX "DemoWaitlistEntry_email_idx" ON "DemoWaitlistEntry"("email");

-- CreateIndex
CREATE INDEX "DemoWaitlistEntry_clerkUserId_idx" ON "DemoWaitlistEntry"("clerkUserId");
