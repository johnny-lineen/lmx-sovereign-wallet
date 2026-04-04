import type { Prisma, VaultItemType, VaultRelationType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const vaultItemListSelect = {
  id: true,
  type: true,
  status: true,
  title: true,
  summary: true,
  provider: true,
  metadata: true,
  createdAt: true,
} satisfies Prisma.VaultItemSelect;

export type VaultItemListRow = Prisma.VaultItemGetPayload<{ select: typeof vaultItemListSelect }>;

export async function countVaultItemsByUserId(userId: string): Promise<number> {
  return prisma.vaultItem.count({ where: { userId } });
}

export async function listVaultItemsForUser(userId: string): Promise<VaultItemListRow[]> {
  return prisma.vaultItem.findMany({
    where: { userId },
    select: vaultItemListSelect,
    orderBy: [{ type: "asc" }, { title: "asc" }],
  });
}

export async function listVaultItemsByTypeForUser(
  userId: string,
  type: VaultItemType,
): Promise<VaultItemListRow[]> {
  return prisma.vaultItem.findMany({
    where: { userId, type },
    select: vaultItemListSelect,
    orderBy: { createdAt: "asc" },
  });
}

export async function createVaultItemForUser(
  userId: string,
  data: {
    type: VaultItemType;
    title: string;
    summary?: string | null;
    provider?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<{ id: string }> {
  return prisma.vaultItem.create({
    data: {
      userId,
      type: data.type,
      title: data.title,
      summary: data.summary ?? null,
      provider: data.provider ?? null,
      ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
    },
    select: { id: true },
  });
}

export async function findVaultItemByIdForUser(
  userId: string,
  itemId: string,
): Promise<{ id: string } | null> {
  return prisma.vaultItem.findFirst({
    where: { id: itemId, userId },
    select: { id: true },
  });
}

export async function findVaultItemByIdAndTypeForUser(
  userId: string,
  itemId: string,
  type: VaultItemType,
): Promise<{ id: string; type: VaultItemType } | null> {
  return prisma.vaultItem.findFirst({
    where: { id: itemId, userId, type },
    select: { id: true, type: true },
  });
}

export async function listVaultRelationshipsForUser(userId: string) {
  return prisma.vaultRelationship.findMany({
    where: { userId },
    include: {
      fromItem: { select: { id: true, title: true, type: true } },
      toItem: { select: { id: true, title: true, type: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function findVaultItemsByCanonicalDomainForUser(
  userId: string,
  canonicalDomain: string,
  types: VaultItemType[],
  tx?: Prisma.TransactionClient,
): Promise<{ id: string; type: VaultItemType }[]> {
  const db = tx ?? prisma;
  const lowered = canonicalDomain.trim().toLowerCase();
  if (!lowered) return [];
  return db.vaultItem.findMany({
    where: {
      userId,
      type: { in: types },
      metadata: {
        path: ["canonicalProviderDomain"],
        equals: lowered,
      },
    },
    select: { id: true, type: true },
  });
}

export async function findVaultRelationshipForUser(
  userId: string,
  fromItemId: string,
  toItemId: string,
  relationType: VaultRelationType,
  tx?: Prisma.TransactionClient,
): Promise<{ id: string } | null> {
  const db = tx ?? prisma;
  return db.vaultRelationship.findFirst({
    where: { userId, fromItemId, toItemId, relationType },
    select: { id: true },
  });
}
