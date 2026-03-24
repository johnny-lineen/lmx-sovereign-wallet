import type { LMXIdentity, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function findRootIdentityByUserId(userId: string): Promise<LMXIdentity | null> {
  return prisma.lMXIdentity.findFirst({
    where: { userId, isRoot: true },
  });
}

export async function updateIdentityForUser(
  id: string,
  userId: string,
  data: Pick<Prisma.LMXIdentityUpdateInput, "displayName" | "summary">,
): Promise<LMXIdentity | null> {
  const owned = await prisma.lMXIdentity.findFirst({
    where: { id, userId },
  });
  if (!owned) return null;

  try {
    return await prisma.lMXIdentity.update({
      where: { id },
      data,
    });
  } catch {
    return null;
  }
}
