import type { Prisma, VaultRelationType } from "@prisma/client";

import type { ImportCandidateCreateRow } from "@/server/repositories/gmail-import.repository";
import {
  ACCOUNT_AGG_THRESHOLD,
  SUBSCRIPTION_AGG_THRESHOLD,
  type ExtractedCandidate,
} from "@/server/services/import-candidate-extraction.service";

/** Bump when aggregation rules or provider registry change materially. */
export const IMPORT_EXTRACTOR_VERSION = "2026-04-aggregated-v1";

export type ScanRelationPlanEntry = {
  fromDedupeKey: string;
  toDedupeKey: string;
  relationType: VaultRelationType;
  normalizedProviderDomain: string;
};

function parseMinConfidence(): number {
  const raw = process.env.IMPORT_MIN_CANDIDATE_CONFIDENCE?.trim();
  if (!raw) return 0.32;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1) return 0.32;
  return n;
}

/**
 * Map aggregated rule score to 0–1 for UI and optional promotion policy.
 */
export function confidenceFromExtractedCandidate(candidate: ExtractedCandidate): number {
  const bucket = candidate.suggestedType === "subscription" ? "subscription" : "account";
  const threshold = bucket === "account" ? ACCOUNT_AGG_THRESHOLD : SUBSCRIPTION_AGG_THRESHOLD;
  const score = Number(candidate.evidence.aggregatedScore ?? 0);
  const span = Math.max(threshold * 4, 1);
  const excess = Math.max(0, score - threshold);
  const c = 0.38 + (excess / span) * 0.58;
  return Math.min(0.99, Math.round(c * 100) / 100);
}

export function buildRelationPlanForExtracted(candidates: ExtractedCandidate[]): ScanRelationPlanEntry[] {
  const byDomain = new Map<string, Set<string>>();
  for (const c of candidates) {
    const d = c.providerDomain?.trim().toLowerCase() ?? "";
    if (!d) continue;
    if (!byDomain.has(d)) byDomain.set(d, new Set());
    byDomain.get(d)!.add(c.suggestedType);
  }

  const plan: ScanRelationPlanEntry[] = [];
  for (const [domain, types] of byDomain) {
    if (types.has("subscription") && types.has("account")) {
      plan.push({
        fromDedupeKey: `${domain}::subscription`,
        toDedupeKey: `${domain}::account`,
        relationType: "belongs_to",
        normalizedProviderDomain: domain,
      });
    }
  }
  return plan;
}

export type PipelineStats = {
  messagesFetched: number;
  messagesAnalyzed: number;
  providersSeen: number;
  candidatesEmittedAccount: number;
  candidatesEmittedSubscription: number;
  candidatesAfterConfidenceFilter: number;
  weakDroppedCount: number;
  relationPlanCount: number;
};

export function buildImportRowsFromExtracted(params: {
  userId: string;
  importJobId: string;
  extracted: ExtractedCandidate[];
  /** Total Gmail messages loaded for this scan (normalized scan docs). */
  messagesFetched: number;
}): {
  rows: ImportCandidateCreateRow[];
  stats: PipelineStats;
  relationPlan: ScanRelationPlanEntry[];
} {
  const minConf = parseMinConfidence();
  const emittedAccount = params.extracted.filter((e) => e.suggestedType === "account").length;
  const emittedSub = params.extracted.filter((e) => e.suggestedType === "subscription").length;
  const domains = new Set(
    params.extracted.map((e) => e.providerDomain?.trim().toLowerCase()).filter((d): d is string => Boolean(d)),
  );

  const relationPlan = buildRelationPlanForExtracted(params.extracted);

  const rows: ImportCandidateCreateRow[] = [];
  let weakDropped = 0;

  for (const ex of params.extracted) {
    const confidence = confidenceFromExtractedCandidate(ex);
    if (confidence < minConf) {
      weakDropped += 1;
      continue;
    }

    const evidence: Record<string, unknown> = {
      ...ex.evidence,
      confidence,
      sampleMessageIds: ex.evidence.sampleMessageIds ?? [],
      gmailMessageId: ex.evidence.gmailMessageId ?? null,
      source: "gmail-scan-aggregated",
      extractorVersion: IMPORT_EXTRACTOR_VERSION,
    };

    rows.push({
      userId: params.userId,
      importJobId: params.importJobId,
      signal: ex.signal,
      suggestedType: ex.suggestedType,
      title: ex.title,
      provider: ex.provider,
      providerDomain: ex.providerDomain,
      evidence: evidence as Prisma.InputJsonValue,
      dedupeKey: ex.dedupeKey,
    });
  }

  return {
    rows,
    relationPlan,
    stats: {
      messagesFetched: params.messagesFetched,
      messagesAnalyzed: params.messagesFetched,
      providersSeen: domains.size,
      candidatesEmittedAccount: emittedAccount,
      candidatesEmittedSubscription: emittedSub,
      candidatesAfterConfidenceFilter: rows.length,
      weakDroppedCount: weakDropped,
      relationPlanCount: relationPlan.length,
    },
  };
}
