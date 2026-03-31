-- CreateEnum
CREATE TYPE "VaultItemType" AS ENUM ('email', 'account', 'subscription', 'social_account', 'device', 'file_reference', 'payment_method_reference', 'credential_reference', 'identity_profile', 'custom');

-- CreateEnum
CREATE TYPE "VaultItemStatus" AS ENUM ('active', 'inactive', 'unknown', 'compromised', 'archived');

-- CreateEnum
CREATE TYPE "VaultRelationType" AS ENUM ('uses_email', 'owned_by', 'linked_to', 'pays_with', 'recovers_with', 'belongs_to', 'signs_in_with', 'duplicate_of', 'accesses', 'created_from');

-- CreateTable
CREATE TABLE "VaultItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lmxIdentityId" TEXT,
    "type" "VaultItemType" NOT NULL,
    "status" "VaultItemStatus" NOT NULL DEFAULT 'active',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultRelationship" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromItemId" TEXT NOT NULL,
    "toItemId" TEXT NOT NULL,
    "relationType" "VaultRelationType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultItemTag" (
    "vaultItemId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultItemTag_pkey" PRIMARY KEY ("vaultItemId", "tagId")
);

-- CreateTable
CREATE TABLE "AgentQueryLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentQueryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VaultItem_userId_idx" ON "VaultItem"("userId");

-- CreateIndex
CREATE INDEX "VaultItem_userId_type_idx" ON "VaultItem"("userId", "type");

-- CreateIndex
CREATE INDEX "VaultItem_userId_status_idx" ON "VaultItem"("userId", "status");

-- CreateIndex
CREATE INDEX "VaultItem_lmxIdentityId_idx" ON "VaultItem"("lmxIdentityId");

-- CreateIndex
CREATE INDEX "VaultRelationship_userId_idx" ON "VaultRelationship"("userId");

-- CreateIndex
CREATE INDEX "VaultRelationship_fromItemId_idx" ON "VaultRelationship"("fromItemId");

-- CreateIndex
CREATE INDEX "VaultRelationship_toItemId_idx" ON "VaultRelationship"("toItemId");

-- CreateIndex
CREATE INDEX "VaultRelationship_userId_relationType_idx" ON "VaultRelationship"("userId", "relationType");

-- CreateIndex
CREATE INDEX "Tag_userId_idx" ON "Tag"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_userId_name_key" ON "Tag"("userId", "name");

-- CreateIndex
CREATE INDEX "VaultItemTag_tagId_idx" ON "VaultItemTag"("tagId");

-- CreateIndex
CREATE INDEX "VaultItemTag_vaultItemId_idx" ON "VaultItemTag"("vaultItemId");

-- CreateIndex
CREATE INDEX "AgentQueryLog_userId_idx" ON "AgentQueryLog"("userId");

-- CreateIndex
CREATE INDEX "AgentQueryLog_userId_createdAt_idx" ON "AgentQueryLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "VaultItem" ADD CONSTRAINT "VaultItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultItem" ADD CONSTRAINT "VaultItem_lmxIdentityId_fkey" FOREIGN KEY ("lmxIdentityId") REFERENCES "LMXIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultRelationship" ADD CONSTRAINT "VaultRelationship_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultRelationship" ADD CONSTRAINT "VaultRelationship_fromItemId_fkey" FOREIGN KEY ("fromItemId") REFERENCES "VaultItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultRelationship" ADD CONSTRAINT "VaultRelationship_toItemId_fkey" FOREIGN KEY ("toItemId") REFERENCES "VaultItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultItemTag" ADD CONSTRAINT "VaultItemTag_vaultItemId_fkey" FOREIGN KEY ("vaultItemId") REFERENCES "VaultItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultItemTag" ADD CONSTRAINT "VaultItemTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentQueryLog" ADD CONSTRAINT "AgentQueryLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
