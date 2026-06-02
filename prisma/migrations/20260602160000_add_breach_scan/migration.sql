-- CreateTable
CREATE TABLE "BreachScan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "breaches" JSONB NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BreachScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BreachScan_userId_idx" ON "BreachScan"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BreachScan_userId_email_key" ON "BreachScan"("userId", "email");

-- AddForeignKey
ALTER TABLE "BreachScan" ADD CONSTRAINT "BreachScan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
