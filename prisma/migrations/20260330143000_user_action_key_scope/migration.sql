-- AddColumn
ALTER TABLE "UserAction" ADD COLUMN "actionKey" TEXT;

-- Backfill existing rows with the legacy action id value.
UPDATE "UserAction"
SET "actionKey" = "id"
WHERE "actionKey" IS NULL;

-- Set required constraint after data backfill.
ALTER TABLE "UserAction" ALTER COLUMN "actionKey" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "UserAction_userId_actionKey_key" ON "UserAction"("userId", "actionKey");
