import { prisma } from "@/lib/prisma";
import type { ReviewPublicAuditCandidatesInput } from "@/lib/validations/public-audit";
import * as publicAuditRepo from "@/server/repositories/public-audit.repository";
import * as userRepo from "@/server/repositories/user.repository";
import * as vaultRepo from "@/server/repositories/vault.repository";
import { importPublicAuditCandidate } from "@/server/services/public-audit-import.service";

export type ReviewPublicAuditResult =
  | {
      ok: true;
      processed: number;
      skipped: number;
      importedVaultItemIds: string[];
      addedToVaultCount: number;
      duplicatesFoundCount: number;
    }
  | { ok: false; code: "USER_NOT_FOUND" | "NO_CANDIDATES" | "EMAIL_ITEM_INVALID" };

async function refreshRunAggregates(userId: string, runId: string) {
  const [total, imported, pending] = await Promise.all([
    prisma.publicAuditCandidate.count({ where: { userId, auditRunId: runId } }),
    prisma.publicAuditCandidate.count({
      where: {
        userId,
        auditRunId: runId,
        status: { in: ["auto_imported", "linked_existing", "accepted"] },
      },
    }),
    prisma.publicAuditCandidate.count({
      where: { userId, auditRunId: runId, status: "pending" },
    }),
  ]);

  const nextStatus = pending > 0 ? ("awaiting_review" as const) : ("completed" as const);

  await prisma.publicAuditRun.updateMany({
    where: { id: runId, userId },
    data: {
      totalCandidates: total,
      importedCount: imported,
      reviewCount: pending,
      status: nextStatus,
    },
  });
}

export async function reviewPublicAuditCandidates(
  clerkUserId: string,
  input: ReviewPublicAuditCandidatesInput,
): Promise<ReviewPublicAuditResult> {
  const user = await userRepo.findUserByClerkId(clerkUserId);
  if (!user) return { ok: false, code: "USER_NOT_FOUND" };

  const uniqueIds = [...new Set(input.candidateIds)];
  const pending = await publicAuditRepo.findPublicAuditCandidatesForUserByIds(user.id, uniqueIds, ["pending"]);
  if (pending.length === 0) return { ok: false, code: "NO_CANDIDATES" };
  const skipped = Math.max(0, uniqueIds.length - pending.length);

  if (input.action === "reject") {
    await prisma.publicAuditCandidate.updateMany({
      where: { userId: user.id, id: { in: pending.map((c) => c.id) }, status: "pending" },
      data: { status: "rejected" },
    });
    const runIds = [...new Set(pending.map((c) => c.auditRunId))];
    for (const runId of runIds) {
      await refreshRunAggregates(user.id, runId);
    }
    return {
      ok: true,
      processed: pending.length,
      skipped,
      importedVaultItemIds: [],
      addedToVaultCount: 0,
      duplicatesFoundCount: 0,
    };
  }

  if (input.action === "ignore") {
    await prisma.publicAuditCandidate.updateMany({
      where: { userId: user.id, id: { in: pending.map((c) => c.id) }, status: "pending" },
      data: { status: "ignored" },
    });
    const runIds = [...new Set(pending.map((c) => c.auditRunId))];
    for (const runId of runIds) {
      await refreshRunAggregates(user.id, runId);
    }
    return {
      ok: true,
      processed: pending.length,
      skipped,
      importedVaultItemIds: [],
      addedToVaultCount: 0,
      duplicatesFoundCount: 0,
    };
  }

  if (input.action !== "accept") {
    return { ok: false, code: "NO_CANDIDATES" };
  }

  const emailVaultItemId = input.emailVaultItemId;
  if (!emailVaultItemId) {
    return { ok: false, code: "EMAIL_ITEM_INVALID" };
  }

  const emailItem = await vaultRepo.findVaultItemByIdAndTypeForUser(user.id, emailVaultItemId, "email");
  if (!emailItem) return { ok: false, code: "EMAIL_ITEM_INVALID" };

  const importedVaultItemIds: string[] = [];
  let addedToVaultCount = 0;
  let duplicatesFoundCount = 0;

  await prisma.$transaction(
    async (tx) => {
      for (const c of pending) {
        const fresh = await tx.publicAuditCandidate.findFirst({
          where: { id: c.id, userId: user.id, status: "pending" },
        });
        if (!fresh) continue;

        const result = await importPublicAuditCandidate(
          tx,
          user.id,
          {
            id: fresh.id,
            proposedVaultType: fresh.proposedVaultType,
            title: fresh.title,
            sourceType: fresh.sourceType,
            sourceName: fresh.sourceName,
            url: fresh.url,
            snippet: fresh.snippet,
            matchedIdentifier: fresh.matchedIdentifier,
            confidenceScore: fresh.confidenceScore,
            confidenceBand: fresh.confidenceBand,
            rawData: fresh.rawData,
          },
          emailVaultItemId,
          fresh.auditRunId,
        );

        await tx.publicAuditCandidate.update({
          where: { id: fresh.id },
          data: {
            status: result.status,
            createdVaultItemId: result.vaultItemId,
          },
        });
        if (result.status === "auto_imported") {
          addedToVaultCount += 1;
          importedVaultItemIds.push(result.vaultItemId);
        } else {
          duplicatesFoundCount += 1;
        }
      }
    },
    { maxWait: 20_000, timeout: 120_000 },
  );

  const runIds = [...new Set(pending.map((c) => c.auditRunId))];
  for (const runId of runIds) {
    await refreshRunAggregates(user.id, runId);
  }

  return {
    ok: true,
    processed: pending.length,
    skipped,
    importedVaultItemIds,
    addedToVaultCount,
    duplicatesFoundCount,
  };
}
