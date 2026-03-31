import type { Prisma, VaultRelationship } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type { ListVaultRelationshipsInput } from "@/lib/validations/relationship";

export async function createVaultRelationshipForUser(
  userId: string,
  data: {
    fromItemId: string;
    toItemId: string;
    relationType: VaultRelationship["relationType"];
    metadata: Prisma.InputJsonValue | undefined;
  },
): Promise<VaultRelationship> {
  return prisma.vaultRelationship.create({
    data: {
      userId,
      fromItemId: data.fromItemId,
      toItemId: data.toItemId,
      relationType: data.relationType,
      ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
    },
  });
}

export async function listVaultRelationshipsForUser(
  userId: string,
  filters: ListVaultRelationshipsInput,
): Promise<VaultRelationship[]> {
  return prisma.vaultRelationship.findMany({
    where: {
      userId,
      ...(filters.fromItemId !== undefined && { fromItemId: filters.fromItemId }),
      ...(filters.toItemId !== undefined && { toItemId: filters.toItemId }),
      ...(filters.relationType !== undefined && { relationType: filters.relationType }),
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function findVaultRelationshipByIdForUser(
  userId: string,
  id: string,
): Promise<VaultRelationship | null> {
  return prisma.vaultRelationship.findFirst({
    where: { id, userId },
  });
}

export async function deleteVaultRelationshipForUser(userId: string, id: string): Promise<boolean> {
  const result = await prisma.vaultRelationship.deleteMany({
    where: { id, userId },
  });
  return result.count > 0;
}
