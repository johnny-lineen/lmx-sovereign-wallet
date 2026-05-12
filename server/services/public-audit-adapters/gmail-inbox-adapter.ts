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
const AUDIT_MIN_CANDIDATE_CONFIDENCE = 0.12;
const MAX_GMAIL_AUDIT_CANDIDATES = 60;
const SOCIAL_PROVIDER_DOMAINS = new Set([
  "linkedin.com",
  "x.com",
  "twitter.com",
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "reddit.com",
  "github.com",
  "youtube.com",
  "discord.com",
  "snapchat.com",
]);
const BROKER_PROVIDER_DOMAINS = new Set([
  "whitepages.com",
  "spokeo.com",
  "beenverified.com",
  "truthfinder.com",
  "peekyou.com",
  "mylife.com",
  "peoplefinder.com",
  "radaris.com",
  "fastpeoplesearch.com",
  "truepeoplesearch.com",
]);

function normalizeDomain(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim().toLowerCase() : null;
}

function buildDerivedGmailCandidates(
  ex: ExtractedCandidate,
  score: number,
  band: "low" | "medium",
  matchedIdentifier: string,
): RawPublicAuditCandidate[] {
  const domain = normalizeDomain(ex.providerDomain);
  if (!domain) return [];
  const out: RawPublicAuditCandidate[] = [];
  const summary = typeof ex.evidence.summary === "string" ? ex.evidence.summary : "";
  if (SOCIAL_PROVIDER_DOMAINS.has(domain)) {
    out.push({
      sourceType: "public_profile_adapter",
      sourceName: "Gmail social correlation",
      proposedVaultType: "social_account",
      title: `Social account signal: ${ex.title}`,
      snippet: summary ? `Inbox evidence indicates social activity. ${summary}` : "Inbox evidence indicates social activity.",
      matchedIdentifier,
      confidenceBand: band,
      confidenceScore: Math.min(0.79, score + 0.06),
      auditKind: "profile",
      rawData: {
        provider: "gmail_inbox_derived",
        derivedKind: "social_profile",
        providerDomain: domain,
        dedupeKey: ex.dedupeKey,
      },
    });
  }
  if (BROKER_PROVIDER_DOMAINS.has(domain)) {
    out.push({
      sourceType: "broker_presence_adapter",
      sourceName: "Gmail broker correlation",
      proposedVaultType: "custom",
      title: `Data broker signal: ${ex.title}`,
      snippet: summary
        ? `Inbox evidence suggests data-broker presence. ${summary}`
        : "Inbox evidence suggests possible data-broker presence.",
      matchedIdentifier,
      confidenceBand: band,
      confidenceScore: Math.min(0.74, score + 0.05),
      auditKind: "broker",
      rawData: {
        provider: "gmail_inbox_derived",
        derivedKind: "broker_presence",
        providerDomain: domain,
        dedupeKey: ex.dedupeKey,
      },
    });
  }
  if (ex.suggestedType === "subscription") {
    out.push({
      sourceType: "gmail_subscription_adapter",
      sourceName: "Gmail subscription signal",
      proposedVaultType: "subscription",
      title: `Subscription from inbox: ${ex.title}`,
      snippet: summary || "Recurring service pattern inferred from inbox evidence.",
      matchedIdentifier,
      confidenceBand: band,
      confidenceScore: Math.min(0.77, score + 0.04),
      auditKind: "other",
      rawData: {
        provider: "gmail_inbox_derived",
        derivedKind: "subscription",
        providerDomain: domain,
        dedupeKey: ex.dedupeKey,
      },
    });
  }
  return out;
}

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
  const dedupe = new Set<string>();
  for (const { ex, rawScore } of scored.slice(0, MAX_GMAIL_AUDIT_CANDIDATES)) {

    const score = cappedScoreForAudit(rawScore);
    const band = confidenceBandForPublicAudit(rawScore);

    const baseCandidate: RawPublicAuditCandidate = {
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
    };
    const baseKey = `${baseCandidate.sourceType}|${baseCandidate.title.toLowerCase()}|${baseCandidate.matchedIdentifier ?? ""}`;
    if (!dedupe.has(baseKey)) {
      dedupe.add(baseKey);
      out.push(baseCandidate);
    }

    const derived = buildDerivedGmailCandidates(ex, score, band, matchedIdentifier);
    for (const candidate of derived) {
      const key = `${candidate.sourceType}|${candidate.title.toLowerCase()}|${candidate.matchedIdentifier ?? ""}`;
      if (dedupe.has(key)) continue;
      dedupe.add(key);
      out.push(candidate);
    }
  }

  return out.slice(0, MAX_GMAIL_AUDIT_CANDIDATES);
}
