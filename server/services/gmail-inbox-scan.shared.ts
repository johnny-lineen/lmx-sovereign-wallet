import { google } from "googleapis";

import { createGmailOAuth2Client } from "@/lib/gmail-oauth";
import * as gmailImportRepo from "@/server/repositories/gmail-import.repository";
import {
  aggregateImportCandidatesFromMessages,
  buildGmailMessageMeta,
  type ExtractedCandidate,
  type GmailMessageMeta,
} from "@/server/services/import-candidate-extraction.service";

export const CANDIDATE_SCAN_MAX_MESSAGES = 2500;
export const CANDIDATE_SCAN_FETCH_BATCH = 500;
export const CANDIDATE_SCAN_QUERY = "newer_than:540d";

export async function persistGmailConnectorAccessTokens(
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

export type GmailInboxExtractedResult = {
  extracted: ExtractedCandidate[];
  messagesFetched: number;
  connectorId: string;
  connectorAddress: string;
};

export type GmailScanFailureCode =
  | "no_connector"
  | "no_matching_connector"
  | "connector_secret_missing"
  | "gmail_api_error"
  | "gmail_reauth_required";

export class GmailScanError extends Error {
  readonly code: GmailScanFailureCode;
  readonly connectorAddress: string | null;

  constructor(code: GmailScanFailureCode, message: string, connectorAddress?: string | null) {
    super(message);
    this.name = "GmailScanError";
    this.code = code;
    this.connectorAddress = connectorAddress ?? null;
  }
}

export function pickGmailConnectorForScan(
  connectors: Array<{ id: string; gmailAddress: string }>,
  submittedEmail?: string | null,
): { id: string; gmailAddress: string } | null {
  if (connectors.length === 0) return null;
  const normalizedSubmittedEmail = submittedEmail?.trim().toLowerCase() ?? null;
  if (!normalizedSubmittedEmail) return connectors[0]!;
  return connectors.find((connector) => connector.gmailAddress.trim().toLowerCase() === normalizedSubmittedEmail) ?? null;
}

/**
 * Loads the user's first Gmail connector, scans inbox (same window as import jobs), aggregates candidates.
 * Returns null when no connector exists. Throws on Gmail API errors.
 */
export async function fetchGmailInboxExtractedForUser(
  userId: string,
  options?: { submittedEmail?: string | null },
): Promise<GmailInboxExtractedResult | null> {
  const connectors = await gmailImportRepo.listGmailConnectorsForUser(userId);
  if (connectors.length === 0) return null;

  const normalizedSubmittedEmail = options?.submittedEmail?.trim().toLowerCase() ?? null;
  const selectedConnector = pickGmailConnectorForScan(connectors, normalizedSubmittedEmail);
  if (!selectedConnector) {
    throw new GmailScanError(
      "no_matching_connector",
      "No connected Gmail mailbox matches the submitted audit email.",
      normalizedSubmittedEmail,
    );
  }

  const connector = await gmailImportRepo.findGmailConnectorWithSecretForUser(userId, selectedConnector.id);
  if (!connector) {
    throw new GmailScanError(
      "connector_secret_missing",
      "Connected Gmail mailbox exists but connector secret is unavailable.",
      selectedConnector.gmailAddress,
    );
  }

  const oauth2 = createGmailOAuth2Client();
  oauth2.setCredentials({
    refresh_token: connector.refreshToken,
    access_token: connector.accessToken ?? undefined,
    expiry_date: connector.accessTokenExpiresAt?.getTime(),
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2 });
  let metas: GmailMessageMeta[];
  try {
    metas = await fetchGmailMessageMetasForCandidateScan(gmail);
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    if (/\binvalid_grant\b/i.test(raw)) {
      throw new GmailScanError(
        "gmail_reauth_required",
        "Gmail token expired. Reconnect Gmail to restore inbox-backed audit signals.",
        selectedConnector.gmailAddress,
      );
    }
    throw new GmailScanError(
      "gmail_api_error",
      "Gmail inbox scan failed while reading mailbox metadata.",
      selectedConnector.gmailAddress,
    );
  }
  await persistGmailConnectorAccessTokens(userId, connector.id, oauth2.credentials);

  const extracted = aggregateImportCandidatesFromMessages(metas);
  const connectorAddress = selectedConnector.gmailAddress.trim().toLowerCase();

  return {
    extracted,
    messagesFetched: metas.length,
    connectorId: connector.id,
    connectorAddress,
  };
}
