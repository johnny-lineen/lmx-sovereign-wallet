import { Prisma, type PublicAuditCandidateStatus } from "@prisma/client";

import { groupCandidatesByPipeline } from "@/lib/public-audit-pipelines";
import { isEmailVerifiedForClerkUser } from "@/lib/clerk-verified-emails";
import { logError, logInfo } from "@/lib/observability";
import type { CreatePublicAuditRunBody } from "@/lib/validations/public-audit";
import { normalizePublicAuditInput } from "@/lib/validations/public-audit";
import * as publicAuditRepo from "@/server/repositories/public-audit.repository";
import * as userRepo from "@/server/repositories/user.repository";
import { executePublicAuditRun } from "@/server/services/public-audit-orchestrator.service";
import * as vaultService from "@/server/services/vault.service";

export type CreatePublicAuditResult =
  | { ok: true; runId: string; internalUserId: string; emailVaultItemId: string }
  | { ok: false; code: "USER_NOT_FOUND" | "EMAIL_NOT_VERIFIED" | "INVALID_EMAIL" };

export async function createPublicAuditRunForClerkUser(
  clerkUserId: string,
  body: CreatePublicAuditRunBody,
  clerkUser: Parameters<typeof isEmailVerifiedForClerkUser>[0],
): Promise<CreatePublicAuditResult> {
  const normalizedInput = normalizePublicAuditInput(body);
  const normalizedEmail = normalizedInput.normalizedEmail;
  if (!isEmailVerifiedForClerkUser(clerkUser, normalizedEmail)) {
    return { ok: false, code: "EMAIL_NOT_VERIFIED" };
  }

  const user = await userRepo.findUserByClerkId(clerkUserId);
  if (!user) return { ok: false, code: "USER_NOT_FOUND" };

  const anchor = await vaultService.ensureEmailVaultItemForClerkUser(clerkUserId, body.email);
  if (!anchor.ok) return { ok: false, code: "INVALID_EMAIL" };

  const usernames = normalizedInput.normalizedUsernames;
  const usernamesJson: Prisma.InputJsonValue | typeof Prisma.JsonNull =
    usernames.length > 0 ? usernames : Prisma.JsonNull;

  const run = await publicAuditRepo.createPublicAuditRun(user.id, {
    fullName: body.fullName.trim(),
    submittedEmail: normalizedEmail,
    usernamesJson,
    locationHint: body.cityState?.trim() || null,
    websiteHint: body.website?.trim() || null,
    notes: body.notes?.trim() || null,
    metadata: {
      consent: body.consent,
      profileEmailVaultItemId: anchor.vaultItemId,
      searchInput: {
        queryType: normalizedInput.queryType,
        query: normalizedInput.query,
        domain: normalizedInput.normalizedDomain,
      },
    } as Prisma.InputJsonValue,
  });

  return {
    ok: true,
    runId: run.id,
    internalUserId: user.id,
    emailVaultItemId: anchor.vaultItemId,
  };
}

/**
 * Kicks off run execution in a detached path from the request/response lifecycle.
 */
export async function executePublicAuditRunDetached(
  userId: string,
  runId: string,
  emailVaultItemId: string,
): Promise<void> {
  try {
    logInfo("public_audit_run_execution_started", { userId, runId });
    await executePublicAuditRun(userId, runId, emailVaultItemId);
    logInfo("public_audit_run_execution_finished", { userId, runId });
  } catch (error) {
    logError("public_audit_run_execution_failed", {
      userId,
      runId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function findInternalUserIdFromClerkId(clerkUserId: string): Promise<string | null> {
  const user = await userRepo.findUserByClerkId(clerkUserId);
  return user?.id ?? null;
}

export function publicAuditRunToDTO(row: publicAuditRepo.PublicAuditRunRow) {
  return {
    id: row.id,
    fullName: row.fullName,
    submittedEmail: row.submittedEmail,
    usernamesJson: row.usernamesJson,
    locationHint: row.locationHint,
    websiteHint: row.websiteHint,
    notes: row.notes,
    status: row.status,
    totalCandidates: row.totalCandidates,
    importedCount: row.importedCount,
    reviewCount: row.reviewCount,
    errorMessage: row.errorMessage,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function publicAuditCandidateToDTO(row: publicAuditRepo.PublicAuditCandidateRow) {
  return {
    id: row.id,
    auditRunId: row.auditRunId,
    sourceType: row.sourceType,
    sourceName: row.sourceName,
    proposedVaultType: row.proposedVaultType,
    title: row.title,
    url: row.url,
    snippet: row.snippet,
    matchedIdentifier: row.matchedIdentifier,
    confidenceScore: row.confidenceScore,
    confidenceBand: row.confidenceBand,
    status: row.status,
    rawData: row.rawData,
    createdVaultItemId: row.createdVaultItemId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listPublicAuditRunsForClerkUser(clerkUserId: string, limit: number) {
  const userId = await findInternalUserIdFromClerkId(clerkUserId);
  if (!userId) return null;
  const rows = await publicAuditRepo.listPublicAuditRunsForUser(userId, limit);
  return rows.map(publicAuditRunToDTO);
}

export async function getPublicAuditRunDetailForClerkUser(
  clerkUserId: string,
  runId: string,
  candidateStatus?: PublicAuditCandidateStatus,
) {
  const userId = await findInternalUserIdFromClerkId(clerkUserId);
  if (!userId) return null;
  const run = await publicAuditRepo.findPublicAuditRunForUser(userId, runId);
  if (!run) return null;
  const candidates = await publicAuditRepo.listPublicAuditCandidatesForRun(userId, runId, {
    ...(candidateStatus !== undefined && { status: candidateStatus }),
  });
  const candidateDtos = candidates.map(publicAuditCandidateToDTO);
  const pipelines = groupCandidatesByPipeline(candidateDtos);
  const metadata =
    run.metadata != null && typeof run.metadata === "object" && !Array.isArray(run.metadata)
      ? (run.metadata as Record<string, unknown>)
      : null;
  return {
    run: publicAuditRunToDTO(run),
    candidates: candidateDtos,
    pipelines,
    diagnostics: metadata?.gmailDiagnostics ?? null,
  };
}
