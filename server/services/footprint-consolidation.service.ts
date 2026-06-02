import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { MAX_REVIEW_CANDIDATE_IDS } from "@/lib/validations/import";
import * as gmailImportRepo from "@/server/repositories/gmail-import.repository";
import * as identityRepo from "@/server/repositories/identity.repository";
import * as userRepo from "@/server/repositories/user.repository";
import * as vaultRepo from "@/server/repositories/vault.repository";
import { reviewImportCandidates } from "@/server/services/import-approval.service";
import { ensureEmailVaultItemForClerkUser } from "@/server/services/vault.service";

async function ensureLinkedToRelationship(userId: string, fromItemId: string, toItemId: string): Promise<void> {
  if (fromItemId === toItemId) return;
  const existing = await vaultRepo.findVaultRelationshipForUser(userId, fromItemId, toItemId, "linked_to");
  if (existing) return;
  await prisma.vaultRelationship.create({
    data: {
      userId,
      fromItemId,
      toItemId,
      relationType: "linked_to",
      metadata: { source: "footprint_consolidation" } as Prisma.InputJsonValue,
    },
  });
}

/**
 * Unifies all Gmail inboxes and imported vault rows under the user's root LMX identity.
 * Idempotent — safe to run after each batch scan.
 */
export async function consolidateUserFootprintForClerkUser(clerkUserId: string): Promise<void> {
  const user = await userRepo.findUserByClerkId(clerkUserId);
  if (!user) return;

  const root = await identityRepo.findRootIdentityByUserId(user.id);
  if (!root) return;

  const pendingByJob = await prisma.importCandidate.groupBy({
    by: ["importJobId"],
    where: { userId: user.id, status: "pending" },
    _count: { _all: true },
  });
  for (const row of pendingByJob) {
    const job = await prisma.importJob.findFirst({
      where: { id: row.importJobId, userId: user.id },
      select: { profileEmailItemId: true },
    });
    if (!job?.profileEmailItemId) continue;
    const pending = await gmailImportRepo.listImportCandidatesForUser(user.id, {
      importJobId: row.importJobId,
      status: "pending",
    });
    if (pending.length === 0) continue;
    for (let i = 0; i < pending.length; i += MAX_REVIEW_CANDIDATE_IDS) {
      const chunk = pending.slice(i, i + MAX_REVIEW_CANDIDATE_IDS);
      await reviewImportCandidates(clerkUserId, {
        action: "approve",
        candidateIds: chunk.map((c) => c.id),
        emailVaultItemId: job.profileEmailItemId,
      });
    }
  }

  await prisma.vaultItem.updateMany({
    where: { userId: user.id, lmxIdentityId: null },
    data: { lmxIdentityId: root.id },
  });

  const connectors = await gmailImportRepo.listGmailConnectorsForUser(user.id);
  const emailVaultIds = new Set<string>();

  for (const connector of connectors) {
    const ensured = await ensureEmailVaultItemForClerkUser(clerkUserId, connector.gmailAddress);
    if (ensured.ok) {
      emailVaultIds.add(ensured.vaultItemId);
      await prisma.vaultItem.updateMany({
        where: { id: ensured.vaultItemId, userId: user.id },
        data: { lmxIdentityId: root.id },
      });
    }
  }

  const emailItems = await vaultRepo.listVaultItemsByTypeForUser(user.id, "email");
  for (const row of emailItems) {
    emailVaultIds.add(row.id);
    await prisma.vaultItem.updateMany({
      where: { id: row.id, userId: user.id },
      data: { lmxIdentityId: root.id },
    });
  }

  const hubCandidates = [...emailVaultIds];
  if (hubCandidates.length < 2) return;

  const clerkEmailNorm = user.email?.trim().toLowerCase() ?? null;
  let hubId = hubCandidates[0]!;
  if (clerkEmailNorm) {
    const match = emailItems.find((row) => row.title.trim().toLowerCase() === clerkEmailNorm);
    if (match && emailVaultIds.has(match.id)) hubId = match.id;
  }

  for (const emailId of emailVaultIds) {
    if (emailId === hubId) continue;
    await ensureLinkedToRelationship(user.id, emailId, hubId);
    await ensureLinkedToRelationship(user.id, hubId, emailId);
  }
}

export type DashboardInboxFootprint = {
  email: string;
  vaultItemId: string | null;
  linkedAccountCount: number;
};

export type DashboardFootprintDTO = {
  clerkEmail: string | null;
  connectedInboxes: DashboardInboxFootprint[];
  vaultItemCount: number;
  accountCount: number;
  subscriptionCount: number;
  emailCount: number;
};

export async function getDashboardFootprintForClerkUser(
  clerkUserId: string,
): Promise<DashboardFootprintDTO | null> {
  await consolidateUserFootprintForClerkUser(clerkUserId);

  const user = await userRepo.findUserByClerkId(clerkUserId);
  if (!user) return null;

  const [connectors, items] = await Promise.all([
    gmailImportRepo.listGmailConnectorsForUser(user.id),
    vaultRepo.listVaultItemsForUser(user.id),
  ]);

  const emailItems = items.filter((i) => i.type === "email");
  const emailByTitle = new Map(emailItems.map((e) => [e.title.trim().toLowerCase(), e.id]));

  const inboxEmails = new Set<string>();
  for (const c of connectors) inboxEmails.add(c.gmailAddress.trim().toLowerCase());
  for (const e of emailItems) inboxEmails.add(e.title.trim().toLowerCase());

  const connectedInboxes: DashboardInboxFootprint[] = [];
  for (const email of [...inboxEmails].sort()) {
    const vaultItemId = emailByTitle.get(email) ?? null;
    let linkedAccountCount = 0;
    if (vaultItemId) {
      linkedAccountCount = await prisma.vaultRelationship.count({
        where: {
          userId: user.id,
          relationType: "uses_email",
          toItemId: vaultItemId,
          fromItem: { type: { in: ["account", "subscription"] } },
        },
      });
    }
    connectedInboxes.push({ email, vaultItemId, linkedAccountCount });
  }

  return {
    clerkEmail: user.email,
    connectedInboxes,
    vaultItemCount: items.length,
    accountCount: items.filter((i) => i.type === "account").length,
    subscriptionCount: items.filter((i) => i.type === "subscription").length,
    emailCount: emailItems.length,
  };
}
