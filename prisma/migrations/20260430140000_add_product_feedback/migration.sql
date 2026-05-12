-- CreateEnum
CREATE TYPE "FeedbackTheme" AS ENUM ('confusion', 'perceived_value', 'trust', 'insight_quality', 'expectations', 'funnel_dropoff');

-- CreateTable
CREATE TABLE "ProductFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "theme" "FeedbackTheme" NOT NULL,
    "surface" VARCHAR(64) NOT NULL,
    "message" TEXT,
    "rating" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductFeedback_createdAt_idx" ON "ProductFeedback"("createdAt");

-- CreateIndex
CREATE INDEX "ProductFeedback_theme_idx" ON "ProductFeedback"("theme");

-- CreateIndex
CREATE INDEX "ProductFeedback_surface_idx" ON "ProductFeedback"("surface");

-- CreateIndex
CREATE INDEX "ProductFeedback_userId_createdAt_idx" ON "ProductFeedback"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProductFeedback" ADD CONSTRAINT "ProductFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
