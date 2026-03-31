import { google } from "googleapis";
import type { ImportCandidateSignal, Prisma } from "@prisma/client";

import { createGmailOAuth2Client } from "@/lib/gmail-oauth";
import { logError, logInfo, sendOpsAlert } from "@/lib/observability";
import * as gmailImportRepo from "@/server/repositories/gmail-import.repository";
import * as userRepo from "@/server/repositories/user.repository";
import * as vaultService from "@/server/services/vault.service";
const CANDIDATE_SCAN_MAX_MESSAGES = 2000;
const CANDIDATE_SCAN_FETCH_BATCH = 500;
const CANDIDATE_SCAN_QUERY = "newer_than:365d";
const IMPORT_SCAN_COOLDOWN_MS = 2 * 60 * 1000;

const BASE_PROVIDER_MAP: Record<string, string> = {
  "amazon.com": "Amazon",
  "accounts.google.com": "Google",
  "google.com": "Google",
  "openai.com": "OpenAI",
  "uber.com": "Uber",
  "facebookmail.com": "Meta",
  "meta.com": "Meta",
};
const MASTER_PROVIDER_MAP = new Map<string, string>(Object.entries(BASE_PROVIDER_MAP));

const ACCOUNT_SUBJECT_HINTS = ["verify", "welcome", "security", "login", "reset"] as const;
const SUBSCRIPTION_SUBJECT_HINTS = ["receipt", "invoice", "billing", "payment", "order"] as const;
const PERSONAL_MAIL_PROVIDER_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "ymail.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
]);

export type GmailScanCandidateType = "account" | "subscription";

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

type GmailScanMessage = {
  sender: string;
  subject: string;
  snippet: string;
  timestamp: number;
};

type GmailClassification = GmailScanCandidateType | "unknown";

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

function normalizeSenderDomain(sender: string): string | null {
  const parsed = sender.match(/<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/);
  const email = parsed?.[1]?.toLowerCase() ?? null;
  if (!email) return null;
  const domain = email.split("@")[1]?.toLowerCase().trim() ?? "";
  return domain || null;
}

function stripKnownSubdomain(domain: string): string {
  const lowered = domain.toLowerCase();
  if (lowered.startsWith("www.")) return lowered.slice(4);
  if (lowered.startsWith("mail.")) return lowered.slice(5);
  if (lowered.startsWith("m.")) return lowered.slice(2);
  return lowered;
}

function fallbackRootDomain(domain: string): string {
  const normalized = stripKnownSubdomain(domain);
  const parts = normalized.split(".").filter(Boolean);
  if (parts.length <= 2) return normalized;
  return parts.slice(-2).join(".");
}

function resolveProviderName(senderDomain: string | null): string | null {
  if (!senderDomain) return null;
  const normalized = stripKnownSubdomain(senderDomain);

  const known = MASTER_PROVIDER_MAP.get(normalized);
  if (known) return known;

  const parts = normalized.split(".");
  for (let i = 0; i < parts.length - 1; i += 1) {
    const candidate = parts.slice(i).join(".");
    const mapped = MASTER_PROVIDER_MAP.get(candidate);
    if (mapped) return mapped;
  }

  const root = fallbackRootDomain(normalized);
  const rootMapped = MASTER_PROVIDER_MAP.get(root);
  if (rootMapped) return rootMapped;

  const [sld] = root.split(".");
  if (!sld) return null;
  const inferred = sld.charAt(0).toUpperCase() + sld.slice(1);
  MASTER_PROVIDER_MAP.set(root, inferred);
  return inferred;
}

function cleanSubject(subject: string): string {
  return subject
    .toLowerCase()
    .replace(/^\s*((re|fwd|fw)\s*:\s*)+/gi, "")
    .trim();
}

function cleanSnippet(snippet: string): string {
  return snippet.replace(/\s+/g, " ").trim().slice(0, 300);
}

function classifyEmail(
  cleanedSubject: string,
  cleanedSnippet: string,
  senderDomain: string | null,
): GmailClassification {
  if (ACCOUNT_SUBJECT_HINTS.some((hint) => cleanedSubject.includes(hint))) return "account";
  if (SUBSCRIPTION_SUBJECT_HINTS.some((hint) => cleanedSubject.includes(hint))) return "subscription";
  if (ACCOUNT_SUBJECT_HINTS.some((hint) => cleanedSnippet.includes(hint))) return "account";
  if (SUBSCRIPTION_SUBJECT_HINTS.some((hint) => cleanedSnippet.includes(hint))) return "subscription";
  if (senderDomain && !PERSONAL_MAIL_PROVIDER_DOMAINS.has(fallbackRootDomain(senderDomain))) {
    // High-recall fallback: unknown transactional/service domains are treated as potential accounts.
    return "account";
  }
  return "unknown";
}

function scoreConfidence(params: {
  type: GmailScanCandidateType;
  cleanedSubject: string;
  senderDomain: string | null;
  provider: string;
  snippet: string;
}): number {
  const { type, cleanedSubject, senderDomain, provider, snippet } = params;
  const hints = type === "account" ? ACCOUNT_SUBJECT_HINTS : SUBSCRIPTION_SUBJECT_HINTS;
  const matchedHints = hints.filter((hint) => cleanedSubject.includes(hint)).length;

  let score = 0.45;
  score += Math.min(0.35, matchedHints * 0.17);
  if (senderDomain && MASTER_PROVIDER_MAP.has(stripKnownSubdomain(senderDomain))) score += 0.2;
  else if (provider.length >= 3) score += 0.1;
  if (snippet.length > 0) score += 0.05;
  if (matchedHints === 0) score -= 0.15;
  return Math.min(0.99, Number(score.toFixed(2)));
}

async function fetchMessagesForCandidateScan(gmail: ReturnType<typeof google.gmail>): Promise<GmailScanMessage[]> {
  const messages: GmailScanMessage[] = [];
  let nextPageToken: string | undefined;

  while (messages.length < CANDIDATE_SCAN_MAX_MESSAGES) {
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

    for (const res of detailResponses) {
      const headers = res.data.payload?.headers ?? [];
      const sender = headers.find((h) => h.name?.toLowerCase() === "from")?.value ?? "";
      const subject = headers.find((h) => h.name?.toLowerCase() === "subject")?.value ?? "";
      const internalDate = Number(res.data.internalDate ?? 0);
      messages.push({
        sender,
        subject,
        snippet: cleanSnippet(res.data.snippet ?? ""),
        timestamp: Number.isFinite(internalDate) ? internalDate : 0,
      });
      if (messages.length >= CANDIDATE_SCAN_MAX_MESSAGES) break;
    }

    nextPageToken = listRes.data.nextPageToken ?? undefined;
    if (!nextPageToken) break;
  }

  return messages;
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
  const messages = await fetchMessagesForCandidateScan(gmail);
  await persistOAuthAccessTokens(userId, connector.id, oauth2.credentials);

  return buildCandidatesFromMessages(messages, selectedConnector.gmailAddress);
}

function buildCandidatesFromMessages(messages: GmailScanMessage[], userEmail: string): GmailScanCandidate[] {
  const deduped = new Map<string, GmailScanCandidate>();

  for (const message of messages) {
    const cleanedSubject = cleanSubject(message.subject);
    const classification = classifyEmail(cleanedSubject, message.snippet.toLowerCase(), normalizeSenderDomain(message.sender));
    if (classification === "unknown") continue;

    const senderDomain = normalizeSenderDomain(message.sender);
    const provider = resolveProviderName(senderDomain);
    if (!provider) continue;

    const confidence = scoreConfidence({
      type: classification,
      cleanedSubject,
      senderDomain,
      provider,
      snippet: message.snippet,
    });

    const candidate: GmailScanCandidate = {
      type: classification,
      provider,
      email: userEmail,
      confidence,
      evidence: {
        subject: cleanedSubject,
        sender: message.sender.trim(),
      },
    };

    const key = `${provider.toLowerCase()}::${userEmail.toLowerCase()}::${classification}`;
    const existing = deduped.get(key);
    if (!existing || candidate.confidence > existing.confidence) {
      deduped.set(key, candidate);
    }
  }

  return [...deduped.values()].sort((a, b) => b.confidence - a.confidence);
}

function inferSignalFromCandidate(candidate: GmailScanCandidate): ImportCandidateSignal {
  const subject = candidate.evidence.subject.toLowerCase();
  if (candidate.type === "subscription") {
    if (subject.includes("renew")) return "subscription_renewal";
    return "receipt_invoice";
  }

  if (subject.includes("reset")) return "password_reset";
  if (subject.includes("security") || subject.includes("login")) return "security_alert";
  if (subject.includes("welcome") || subject.includes("verify")) return "welcome_account";
  return "account_activity";
}

function inferProviderDomainFromSender(sender: string): string | null {
  const domain = normalizeSenderDomain(sender);
  return domain ? fallbackRootDomain(domain) : null;
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
    const messages = await fetchMessagesForCandidateScan(gmail);
    const scannedCandidates = buildCandidatesFromMessages(messages, connector.gmailAddress);

    const rows: gmailImportRepo.ImportCandidateCreateRow[] = scannedCandidates.map((candidate) => {
      const signal = inferSignalFromCandidate(candidate);
      const providerDomain = inferProviderDomainFromSender(candidate.evidence.sender);
      const dedupeKey = `${candidate.provider.toLowerCase()}::${candidate.type}`;
      return {
      userId: user.id,
      importJobId: job.id,
      signal,
      suggestedType: candidate.type,
      title: candidate.provider,
      provider: candidate.provider,
      providerDomain,
      evidence: {
        confidence: candidate.confidence,
        subject: candidate.evidence.subject,
        sender: candidate.evidence.sender,
        source: "gmail-scan-v2",
      } as Prisma.InputJsonValue,
      dedupeKey,
    };
    });

    await persistOAuthAccessTokens(user.id, connector.id, oauth2.credentials);

    const inserted = await gmailImportRepo.createImportCandidatesSkipDuplicates(rows);

    await gmailImportRepo.patchImportJob(user.id, job.id, {
      status: "completed",
      completedAt: new Date(),
      metadata: {
        messagesScanned: messages.length,
        candidatesExtracted: rows.length,
        candidatesInserted: inserted,
        gmailQuery: CANDIDATE_SCAN_QUERY,
        providerMasterSize: MASTER_PROVIDER_MAP.size,
      },
    });

    const response: RunImportJobResult = {
      ok: true,
      jobId: job.id,
      insertedCandidates: inserted,
      messagesScanned: messages.length,
      profileEmailItemId,
    };
    logInfo("gmail_import_job_completed", {
      userId: user.id,
      jobId: job.id,
      insertedCandidates: inserted,
      messagesScanned: messages.length,
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
