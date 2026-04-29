import { prisma } from "@/lib/prisma";

export type ClearTemporaryVaultDataResult =
  | { ok: true }
  | { ok: false; code: "USER_NOT_FOUND" };

/**
 * Temporary test helper: clears user-owned vault/import/audit artifacts
 * without deleting the app user or Gmail connector records.
 */
export async function clearTemporaryVaultDataForClerkUser(
  clerkUserId: string,
): Promise<ClearTemporaryVaultDataResult> {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });
  if (!user) return { ok: false, code: "USER_NOT_FOUND" };

  await prisma.$transaction(async (tx) => {
    await tx.publicAuditCandidate.deleteMany({ where: { userId: user.id } });
    await tx.publicAuditRun.deleteMany({ where: { userId: user.id } });

    await tx.importCandidate.deleteMany({ where: { userId: user.id } });
    await tx.importJob.deleteMany({ where: { userId: user.id } });

    await tx.userAction.deleteMany({ where: { userId: user.id } });
    await tx.insight.deleteMany({ where: { userId: user.id } });
    await tx.agentQueryLog.deleteMany({ where: { userId: user.id } });

    await tx.vaultRelationship.deleteMany({ where: { userId: user.id } });
    await tx.vaultItemTag.deleteMany({ where: { vaultItem: { userId: user.id } } });
    await tx.vaultItem.deleteMany({ where: { userId: user.id } });
    await tx.tag.deleteMany({ where: { userId: user.id } });
    await tx.lMXIdentity.deleteMany({ where: { userId: user.id } });
  });

  return { ok: true };
}
