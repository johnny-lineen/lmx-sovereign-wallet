import { google } from "googleapis";

import { createGmailOAuth2Client } from "@/lib/gmail-oauth";
import { logError, logInfo, sendOpsAlert } from "@/lib/observability";
import * as gmailImportRepo from "@/server/repositories/gmail-import.repository";
import * as userRepo from "@/server/repositories/user.repository";
import * as vaultService from "@/server/services/vault.service";
import {
  aggregateImportCandidatesFromMessages,
  buildGmailMessageMeta,
  type GmailMessageMeta,
} from "@/server/services/import-candidate-extraction.service";
import {
  buildImportRowsFromExtracted,
  confidenceFromExtractedCandidate,
  IMPORT_EXTRACTOR_VERSION,
} from "@/server/services/import-scan-pipeline";

const CANDIDATE_SCAN_MAX_MESSAGES = 2000;
const CANDIDATE_SCAN_FETCH_BATCH = 500;
const CANDIDATE_SCAN_QUERY = "newer_than:365d";
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
      insertedCandidates: number;
      messagesScanned: number;
      profileEmailItemId: string;
    }
  | {
      ok: false;
      code:
        | "USER_NOT_FOUND"
        | "CONNECTOR_NOT_FOUND"
        | "PROFILE_EMAIL_INVALID"
        | "GMAIL_ERROR"
        | "IMPORT_COOLDOWN";
      message?: string;
      retryAfterSeconds?: number;
    };

async function persistOAuthAccessTokens(
  userId: string,
  connectorId: string,
  credentials: { access_token?: string | null; expiry_date?: number | null },
) {
  if (!credentials.access_token || credentials.expiry_date == null) return;
  await gmailImportRepo.updateGmailConnectorTokens(userId, connectorId, {
    accessToken: credentials.access_token,
    accessTokenExpiresAt: new Date(credentials.expiry_date),
  });
}

function cleanSnippet(snippet: string): string {
  return snippet.replace(/\s+/g, " ").trim().slice(0, 300);
}

export async function fetchGmailMessageMetasForCandidateScan(
  gmail: ReturnType<typeof google.gmail>,
): Promise<GmailMessageMeta[]> {
  const metas: GmailMessageMeta[] = [];
  let nextPageToken: string | undefined;

  while (metas.length < CANDIDATE_SCAN_MAX_MESSAGES) {
    const listRes = await gmail.users.messages.list({
      userId: "me",
      maxResults: CANDIDATE_SCAN_FETCH_BATCH,
      q: CANDIDATE_SCAN_QUERY,
      pageToken: nextPageToken,
    });

    const refs = listRes.data.messages ?? [];
    const ids = refs.map((m) => m.id).filter((id): id is string => Boolean(id));
    if (ids.length === 0) break;

    const detailResponses = await Promise.all(
      ids.map((id) =>
        gmail.users.messages.get({
          userId: "me",
          id,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        }),
      ),
    );

    for (let i = 0; i < detailResponses.length; i += 1) {
      const res = detailResponses[i]!;
      const id = ids[i]!;
      const headers = res.data.payload?.headers ?? [];
      const snippet = cleanSnippet(res.data.snippet ?? "");
      metas.push(buildGmailMessageMeta(id, headers, snippet));
      if (metas.length >= CANDIDATE_SCAN_MAX_MESSAGES) break;
    }

    nextPageToken = listRes.data.nextPageToken ?? undefined;
    if (!nextPageToken) break;
  }

  return metas;
}

export async function scanGmailForCandidates(userId: string): Promise<GmailScanCandidate[]> {
  const connectors = await gmailImportRepo.listGmailConnectorsForUser(userId);
  const selectedConnector = connectors[0];
  if (!selectedConnector) return [];

  const connector = await gmailImportRepo.findGmailConnectorWithSecretForUser(userId, selectedConnector.id);
  if (!connector) return [];

  const oauth2 = createGmailOAuth2Client();
  oauth2.setCredentials({
    refresh_token: connector.refreshToken,
    access_token: connector.accessToken ?? undefined,
    expiry_date: connector.accessTokenExpiresAt?.getTime(),
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2 });
  const metas = await fetchGmailMessageMetasForCandidateScan(gmail);
  await persistOAuthAccessTokens(userId, connector.id, oauth2.credentials);

  const extracted = aggregateImportCandidatesFromMessages(metas);
  const email = selectedConnector.gmailAddress.toLowerCase();

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

    await persistOAuthAccessTokens(user.id, connector.id, oauth2.credentials);

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
        candidatesInserted: inserted,
        candidatesSkippedDuplicate: skippedDuplicate,
        relationPlan,
        relationPlanCount: stats.relationPlanCount,
        messagesScanned: metas.length,
      },
    });

    const response: RunImportJobResult = {
      ok: true,
      jobId: job.id,
      insertedCandidates: inserted,
      messagesScanned: metas.length,
      profileEmailItemId,
    };
    logInfo("gmail_import_job_completed", {
      userId: user.id,
      jobId: job.id,
      insertedCandidates: inserted,
      messagesScanned: metas.length,
    });
    return response;
  } catch (e) {
    const message = "Gmail import failed";
    await sendOpsAlert("gmail_import_job_failed", {
      userId: user.id,
      jobId: job.id,
      error: e instanceof Error ? e.message : String(e),
    });
    logError("gmail_import_job_failed", {
      userId: user.id,
      jobId: job.id,
      error: e instanceof Error ? e.message : String(e),
    });
    await gmailImportRepo.patchImportJob(user.id, job.id, {
      status: "failed",
      completedAt: new Date(),
      errorMessage: message,
    });
    return { ok: false, code: "GMAIL_ERROR", message };
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
