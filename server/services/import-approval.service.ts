import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { ReviewImportCandidatesInput } from "@/lib/validations/import";
import * as gmailImportRepo from "@/server/repositories/gmail-import.repository";
import * as userRepo from "@/server/repositories/user.repository";
import * as vaultRepo from "@/server/repositories/vault.repository";

export type ReviewImportResult =
  | { ok: true; approvedItemIds: string[]; rejectedCount: number; skippedCount: number }
  | {
      ok: false;
      code: "USER_NOT_FOUND" | "EMAIL_ITEM_INVALID" | "NO_CANDIDATES";
    };

function evidenceSubject(evidence: unknown): string | null {
  if (!evidence || typeof evidence !== "object") return null;
  const s = (evidence as Record<string, unknown>).subject;
  return typeof s === "string" ? s : null;
}

function evidenceConfidence(evidence: unknown): number | undefined {
  if (!evidence || typeof evidence !== "object") return undefined;
  const c = (evidence as Record<string, unknown>).confidence;
  if (typeof c !== "number" || !Number.isFinite(c)) return undefined;
  return Math.max(0, Math.min(1, c));
}

async function ensureBelongsToEdge(
  tx: Prisma.TransactionClient,
  userId: string,
  fromItemId: string,
  toItemId: string,
) {
  const existing = await vaultRepo.findVaultRelationshipForUser(
    userId,
    fromItemId,
    toItemId,
    "belongs_to",
    tx,
  );
  if (existing) return;
  await tx.vaultRelationship.create({
    data: {
      userId,
      fromItemId,
      toItemId,
      relationType: "belongs_to",
      metadata: { source: "gmail_import_inferred" } as Prisma.InputJsonValue,
    },
  });
}

async function linkInferredProviderRelationships(
  tx: Prisma.TransactionClient,
  userId: string,
  newItemId: string,
  suggestedType: string,
  canonicalDomain: string,
) {
  const domain = canonicalDomain.trim().toLowerCase();
  if (!domain) return;

  if (suggestedType === "subscription") {
    const accounts = await vaultRepo.findVaultItemsByCanonicalDomainForUser(
      userId,
      domain,
      ["account"],
      tx,
    );
    const target = accounts.find((a) => a.id !== newItemId);
    if (target) await ensureBelongsToEdge(tx, userId, newItemId, target.id);
    return;
  }

  if (suggestedType === "account") {
    const subscriptions = await vaultRepo.findVaultItemsByCanonicalDomainForUser(
      userId,
      domain,
      ["subscription"],
      tx,
    );
    for (const sub of subscriptions) {
      if (sub.id === newItemId) continue;
      await ensureBelongsToEdge(tx, userId, sub.id, newItemId);
    }
  }
}

export async function reviewImportCandidates(
  clerkUserId: string,
  input: ReviewImportCandidatesInput,
): Promise<ReviewImportResult> {
  const user = await userRepo.findUserByClerkId(clerkUserId);
  if (!user) return { ok: false, code: "USER_NOT_FOUND" };

  const uniqueIds = [...new Set(input.candidateIds)];
  const pending = await gmailImportRepo.findPendingImportCandidatesForUser(user.id, uniqueIds);
  if (pending.length === 0) return { ok: false, code: "NO_CANDIDATES" };
  const skippedCount = Math.max(0, uniqueIds.length - pending.length);

  if (input.action === "reject") {
    await prisma.importCandidate.updateMany({
      where: { userId: user.id, id: { in: pending.map((c) => c.id) }, status: "pending" },
      data: { status: "rejected" },
    });
    return { ok: true, approvedItemIds: [], rejectedCount: pending.length, skippedCount };
  }

  const emailVaultItemId = input.emailVaultItemId;

  const emailItem = await vaultRepo.findVaultItemByIdAndTypeForUser(
    user.id,
    emailVaultItemId,
    "email",
  );
  if (!emailItem) return { ok: false, code: "EMAIL_ITEM_INVALID" };

  const approvedItemIds: string[] = [];
  let claimedSkippedCount = 0;

  // Approve loop runs many queries per candidate (vault item, edges, domain linking).
  // Prisma's default interactive transaction timeout is 5s — exceeded here → P2028 (transaction closed).
  await prisma.$transaction(
    async (tx) => {
      for (const c of pending) {
        const claim = await tx.importCandidate.updateMany({
          where: { id: c.id, userId: user.id, status: "pending" },
          data: { status: "approved" },
        });
        if (claim.count === 0) {
          claimedSkippedCount += 1;
          continue;
        }

        const subj = evidenceSubject(c.evidence);
        const summaryParts = [`Gmail import (${c.signal.replace(/_/g, " ")})`];
        if (subj) summaryParts.push(subj);

        const conf = evidenceConfidence(c.evidence);
        const canonicalDomain = c.providerDomain?.trim().toLowerCase() ?? "";

        const metadata: Record<string, unknown> = {
          source: "gmail_import",
          importCandidateId: c.id,
          signal: c.signal,
          importJobId: c.importJobId,
        };
        if (canonicalDomain.length > 0) metadata.canonicalProviderDomain = canonicalDomain;
        if (conf !== undefined) metadata.confidence = conf;

        const item = await tx.vaultItem.create({
          data: {
            userId: user.id,
            type: c.suggestedType,
            title: c.title,
            summary: summaryParts.join(" — "),
            provider: c.provider,
            metadata: metadata as Prisma.InputJsonValue,
          },
        });

        await tx.vaultRelationship.create({
          data: {
            userId: user.id,
            fromItemId: item.id,
            toItemId: emailVaultItemId,
            relationType: "uses_email",
            metadata: {
              source: "gmail_import",
              importCandidateId: c.id,
            },
          },
        });

        if (canonicalDomain.length > 0) {
          await linkInferredProviderRelationships(tx, user.id, item.id, c.suggestedType, canonicalDomain);
        }

        await tx.importCandidate.updateMany({
          where: { id: c.id, userId: user.id, status: "approved", createdVaultItemId: null },
          data: { status: "approved", createdVaultItemId: item.id },
        });

        approvedItemIds.push(item.id);
      }
    },
    { maxWait: 15_000, timeout: 120_000 },
  );

  return { ok: true, approvedItemIds, rejectedCount: 0, skippedCount: skippedCount + claimedSkippedCount };
}
