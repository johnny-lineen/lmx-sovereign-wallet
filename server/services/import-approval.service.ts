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

  await prisma.$transaction(async (tx) => {
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

      const metadata: Prisma.InputJsonValue = {
        source: "gmail_import",
        importCandidateId: c.id,
        signal: c.signal,
        importJobId: c.importJobId,
      };

      const item = await tx.vaultItem.create({
        data: {
          userId: user.id,
          type: c.suggestedType,
          title: c.title,
          summary: summaryParts.join(" — "),
          provider: c.provider,
          metadata,
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

      await tx.importCandidate.updateMany({
        where: { id: c.id, userId: user.id, status: "approved", createdVaultItemId: null },
        data: { status: "approved", createdVaultItemId: item.id },
      });

      approvedItemIds.push(item.id);
    }
  });

  return { ok: true, approvedItemIds, rejectedCount: 0, skippedCount: skippedCount + claimedSkippedCount };
}
