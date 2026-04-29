import { google } from "googleapis";

import { createGmailOAuth2Client } from "@/lib/gmail-oauth";
import { logError, logInfo, sendOpsAlert } from "@/lib/observability";
import * as gmailImportRepo from "@/server/repositories/gmail-import.repository";
import * as userRepo from "@/server/repositories/user.repository";
import * as vaultService from "@/server/services/vault.service";
import {
  CANDIDATE_SCAN_QUERY,
  GmailScanError,
  fetchGmailInboxExtractedForUser,
  fetchGmailMessageMetasForCandidateScan,
  persistGmailConnectorAccessTokens,
} from "@/server/services/gmail-inbox-scan.shared";
import { aggregateImportCandidatesFromMessages } from "@/server/services/import-candidate-extraction.service";
import {
  buildImportRowsFromExtracted,
  confidenceFromExtractedCandidate,
  IMPORT_EXTRACTOR_VERSION,
} from "@/server/services/import-scan-pipeline";

const IMPORT_SCAN_COOLDOWN_MS = 2 * 60 * 1000;

export type GmailScanCandidateType = "account" | "subscription";

/** Lightweight DTO for previews; full scan uses aggregated extraction. */
export type GmailScanCandidate = {
  type: GmailScanCandidateType;
  provider: string;
  email: string;
  confidence: number;
  evidence: {
    subject: string;
    sender: string;
  };
};

export type RunImportJobResult =
  | {
      ok: true;
      jobId: string;
      detectedCandidates: number;
      insertedCandidates: number;
      dedupedCandidates: number;
      messagesScanned: number;
      profileEmailItemId: string;
    }
  | {
      ok: false;
      code:
        | "USER_NOT_FOUND"
        | "CONNECTOR_NOT_FOUND"
        | "PROFILE_EMAIL_INVALID"
        | "EMAIL_MISMATCH"
        | "GMAIL_ERROR"
        | "GMAIL_REAUTH_REQUIRED"
        | "IMPORT_COOLDOWN";
      message?: string;
      retryAfterSeconds?: number;
    };

export async function scanGmailForCandidates(userId: string): Promise<GmailScanCandidate[]> {
  const inbox = await fetchGmailInboxExtractedForUser(userId);
  if (!inbox) return [];

  const { extracted, connectorAddress: email } = inbox;

  return extracted.map((ex) => {
    const raw = ex.evidence.rawSenderDomains;
    const sender0 = Array.isArray(raw) && typeof raw[0] === "string" ? raw[0] : "";
    return {
      type: ex.suggestedType as GmailScanCandidateType,
      provider: ex.title,
      email,
      confidence: confidenceFromExtractedCandidate(ex),
      evidence: {
        subject: String(ex.evidence.subject ?? ""),
        sender: sender0,
      },
    };
  });
}

export async function runGmailImportJob(
  clerkUserId: string,
  input: { gmailConnectorId: string; profileEmail: string },
): Promise<RunImportJobResult> {
  const user = await userRepo.findUserByClerkId(clerkUserId);
  if (!user) return { ok: false, code: "USER_NOT_FOUND" };

  const connector = await gmailImportRepo.findGmailConnectorWithSecretForUser(user.id, input.gmailConnectorId);
  if (!connector) return { ok: false, code: "CONNECTOR_NOT_FOUND" };
  const normalizedProfileEmail = input.profileEmail.trim().toLowerCase();
  const connectorAddress = connector.gmailAddress.trim().toLowerCase();
  if (connectorAddress !== normalizedProfileEmail) {
    return {
      ok: false,
      code: "EMAIL_MISMATCH",
      message: "Connected Gmail address must exactly match the submitted profile email.",
    };
  }

  const latestJob = await gmailImportRepo.findMostRecentImportJobForUser(user.id);
  if (latestJob?.startedAt) {
    const elapsed = Date.now() - latestJob.startedAt.getTime();
    const retryAfterMs = IMPORT_SCAN_COOLDOWN_MS - elapsed;
    if (retryAfterMs > 0) {
      return {
        ok: false,
        code: "IMPORT_COOLDOWN",
        message: "Scan cooldown active. Please wait before running another inbox scan.",
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      };
    }
  }

  const ensured = await vaultService.ensureEmailVaultItemForClerkUser(clerkUserId, input.profileEmail);
  if (!ensured.ok) {
    return {
      ok: false,
      code: ensured.code === "INVALID_EMAIL" ? "PROFILE_EMAIL_INVALID" : "USER_NOT_FOUND",
    };
  }
  const profileEmailItemId = ensured.vaultItemId;

  const job = await gmailImportRepo.createImportJob(user.id, {
    gmailConnectorId: connector.id,
    profileEmailItemId,
  });

  await gmailImportRepo.patchImportJob(user.id, job.id, { status: "running" });

  const oauth2 = createGmailOAuth2Client();
  oauth2.setCredentials({
    refresh_token: connector.refreshToken,
    access_token: connector.accessToken ?? undefined,
    expiry_date: connector.accessTokenExpiresAt?.getTime(),
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2 });

  try {
    const metas = await fetchGmailMessageMetasForCandidateScan(gmail);
    const extracted = aggregateImportCandidatesFromMessages(metas);
    const { rows, stats, relationPlan } = buildImportRowsFromExtracted({
      userId: user.id,
      importJobId: job.id,
      extracted,
      messagesFetched: metas.length,
    });

    await persistGmailConnectorAccessTokens(user.id, connector.id, oauth2.credentials);

    const inserted = await gmailImportRepo.createImportCandidatesSkipDuplicates(rows);
    const skippedDuplicate = Math.max(0, rows.length - inserted);

    await gmailImportRepo.patchImportJob(user.id, job.id, {
      status: "completed",
      completedAt: new Date(),
      metadata: {
        extractorVersion: IMPORT_EXTRACTOR_VERSION,
        gmailQuery: CANDIDATE_SCAN_QUERY,
        messagesFetched: stats.messagesFetched,
        messagesAnalyzed: stats.messagesAnalyzed,
        providersSeen: stats.providersSeen,
        candidatesEmittedAccount: stats.candidatesEmittedAccount,
        candidatesEmittedSubscription: stats.candidatesEmittedSubscription,
        candidatesExtracted: extracted.length,
        candidatesAfterConfidenceFilter: stats.candidatesAfterConfidenceFilter,
        weakDroppedCount: stats.weakDroppedCount,
        candidatesDetected: rows.length,
        candidatesInserted: inserted,
        candidatesDeduped: skippedDuplicate,
        candidatesSkippedDuplicate: skippedDuplicate,
        diagnostics: {
          status: metas.length > 0 ? "ok" : "scan_empty",
          code: metas.length > 0 ? "ok" : "scan_empty",
          connectorAddress,
          submittedEmail: normalizedProfileEmail,
          strictEmailMatch: true,
        },
        relationPlan,
        relationPlanCount: stats.relationPlanCount,
        messagesScanned: metas.length,
      },
    });

    const response: RunImportJobResult = {
      ok: true,
      jobId: job.id,
      detectedCandidates: rows.length,
      insertedCandidates: inserted,
      dedupedCandidates: skippedDuplicate,
      messagesScanned: metas.length,
      profileEmailItemId,
    };
    logInfo("gmail_import_job_completed", {
      userId: user.id,
      jobId: job.id,
      insertedCandidates: inserted,
      detectedCandidates: rows.length,
      dedupedCandidates: skippedDuplicate,
      messagesScanned: metas.length,
    });
    return response;
  } catch (e) {
    const rawError = e instanceof Error ? e.message : String(e);
    const scanError = e instanceof GmailScanError ? e : null;
    const reauthRequired = scanError?.code === "gmail_reauth_required" || /\binvalid_grant\b/i.test(rawError);
    const message = reauthRequired ? "Gmail connection expired. Please reconnect Gmail and retry." : "Gmail import failed";
    const errorCode = reauthRequired ? "GMAIL_REAUTH_REQUIRED" : "GMAIL_ERROR";
    const diagnosticsCode =
      scanError?.code === "no_matching_connector"
        ? "email_mismatch"
        : scanError?.code === "no_connector"
          ? "no_connector"
          : scanError?.code === "connector_secret_missing"
            ? "connector_secret_missing"
            : reauthRequired
              ? "token_invalid"
              : "gmail_api_error";
    await sendOpsAlert("gmail_import_job_failed", {
      userId: user.id,
      jobId: job.id,
      error: e instanceof Error ? e.message : String(e),
    });
    logError("gmail_import_job_failed", {
      userId: user.id,
      jobId: job.id,
      error: rawError,
      reauthRequired,
    });
    await gmailImportRepo.patchImportJob(user.id, job.id, {
      status: "failed",
      completedAt: new Date(),
      errorMessage: message,
      metadata: {
        diagnostics: {
          status: "error",
          code: diagnosticsCode,
          connectorAddress,
          submittedEmail: normalizedProfileEmail,
          strictEmailMatch: true,
        },
      },
    });
    return { ok: false, code: errorCode, message };
  }
}

export async function listImportJobsDTO(clerkUserId: string) {
  const user = await userRepo.findUserByClerkId(clerkUserId);
  if (!user) return null;
  const jobs = await gmailImportRepo.listImportJobsForUser(user.id);
  return jobs.map((j) => ({
    id: j.id,
    status: j.status,
    startedAt: j.startedAt.toISOString(),
    completedAt: j.completedAt?.toISOString() ?? null,
    errorMessage: j.errorMessage,
    metadata: j.metadata,
    profileEmailItemId: j.profileEmailItemId,
    gmailConnector: j.gmailConnector,
    candidateCount: j._count.candidates,
  }));
}

export async function getImportJobDetailDTO(clerkUserId: string, jobId: string) {
  const user = await userRepo.findUserByClerkId(clerkUserId);
  if (!user) return null;
  const job = await gmailImportRepo.findImportJobForUser(user.id, jobId);
  if (!job) return null;
  const candidates = await gmailImportRepo.listImportCandidatesForUser(user.id, { importJobId: jobId });
  return {
    id: job.id,
    status: job.status,
    startedAt: job.startedAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
    errorMessage: job.errorMessage,
    metadata: job.metadata,
    profileEmailItemId: job.profileEmailItemId,
    gmailConnector: job.gmailConnector,
    candidates,
  };
}
