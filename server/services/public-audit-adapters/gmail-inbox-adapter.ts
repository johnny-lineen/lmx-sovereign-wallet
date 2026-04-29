import type { VaultItemType } from "@prisma/client";

import { fetchGmailInboxExtractedForUser, GmailScanError } from "@/server/services/gmail-inbox-scan.shared";
import type { ExtractedCandidate } from "@/server/services/import-candidate-extraction.service";
import {
  confidenceFromExtractedCandidate,
  IMPORT_EXTRACTOR_VERSION,
} from "@/server/services/import-scan-pipeline";
import type { RawPublicAuditCandidate } from "@/server/services/public-audit-adapters/breach-adapter";

function snippetFromExtracted(ex: ExtractedCandidate): string {
  const subject = String(ex.evidence.subject ?? "").trim();
  const domains = ex.evidence.rawSenderDomains;
  const d0 = Array.isArray(domains) && typeof domains[0] === "string" ? domains[0].trim() : "";
  const parts = [subject && `Subject: ${subject}`, d0 && `Sender domain: ${d0}`].filter(Boolean);
  return parts.join(" · ").slice(0, 400) || "Inferred from connected Gmail inbox.";
}

function confidenceBandForPublicAudit(score: number): "low" | "medium" {
  if (score >= 0.55) return "medium";
  return "low";
}

/**
 * Caps scores so nothing is treated as high-confidence auto-import in the public audit orchestrator.
 */
function cappedScoreForAudit(score: number): number {
  return Math.min(0.72, Math.round(score * 100) / 100);
}

/**
 * Public audit needs broad but still user-tied inbox coverage for the "quick footprint" UX.
 * Keep this lower than import-job threshold, because review step is explicit in public audit.
 */
const AUDIT_MIN_CANDIDATE_CONFIDENCE = 0.18;
const MAX_GMAIL_AUDIT_CANDIDATES = 24;

export async function fetchGmailInboxAuditCandidates(
  internalUserId: string,
  ctx: {
    fullName: string;
    submittedEmail: string;
    usernames: string[];
    websiteHint: string | null;
    locationHint?: string | null;
  },
): Promise<RawPublicAuditCandidate[]> {
  const inbox = await fetchGmailInboxExtractedForUser(internalUserId, { submittedEmail: ctx.submittedEmail });
  if (!inbox) {
    throw new GmailScanError("no_connector", "No Gmail connector found for user.");
  }
  const normalizedSubmittedEmail = ctx.submittedEmail.trim().toLowerCase();

  const matchedIdentifier = normalizedSubmittedEmail;
  const scored: Array<{ ex: ExtractedCandidate; rawScore: number }> = [];

  for (const ex of inbox.extracted) {
    const rawScore = confidenceFromExtractedCandidate(ex);
    if (rawScore < AUDIT_MIN_CANDIDATE_CONFIDENCE) continue;
    scored.push({ ex, rawScore });
  }

  scored.sort((a, b) => b.rawScore - a.rawScore);
  const out: RawPublicAuditCandidate[] = [];
  for (const { ex, rawScore } of scored.slice(0, MAX_GMAIL_AUDIT_CANDIDATES)) {

    const score = cappedScoreForAudit(rawScore);
    const band = confidenceBandForPublicAudit(rawScore);

    out.push({
      sourceType: "gmail_inbox_adapter",
      sourceName: "Gmail inbox",
      proposedVaultType: ex.suggestedType as VaultItemType,
      title: ex.title,
      snippet: snippetFromExtracted(ex),
      matchedIdentifier,
      confidenceBand: band,
      confidenceScore: score,
      auditKind: "other",
      rawData: {
        provider: "gmail_inbox",
        gmailMessageId: ex.evidence.gmailMessageId ?? null,
        sampleMessageIds: ex.evidence.sampleMessageIds ?? [],
        providerDomain: ex.providerDomain ?? null,
        connectorAddress: inbox.connectorAddress,
        extractorVersion: IMPORT_EXTRACTOR_VERSION,
        messagesFetched: inbox.messagesFetched,
        totalExtracted: inbox.extracted.length,
        minConfidenceApplied: AUDIT_MIN_CANDIDATE_CONFIDENCE,
        dedupeKey: ex.dedupeKey,
        signal: ex.signal,
        identity: {
          tiedToSubmittedEmail: true,
          connectorMatchesSubmittedEmail: true,
          tieReason: "gmail_connector_address_match",
        },
      },
    });
  }

  return out;
}
