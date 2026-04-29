import type { RawPublicAuditCandidate } from "@/server/services/public-audit-adapters/breach-adapter";

const SOURCE_MEDIUM_CAPS: Record<string, number> = {
  public_profile_adapter: 20,
  broker_presence_adapter: 10,
  public_search_adapter: 12,
  gmail_inbox_adapter: 20,
};

function identityScoreFromRawData(rawData: RawPublicAuditCandidate["rawData"]): number {
  if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) return 0;
  const identityRaw = (rawData as Record<string, unknown>).identity;
  if (!identityRaw || typeof identityRaw !== "object" || Array.isArray(identityRaw)) return 0;
  const score = (identityRaw as Record<string, unknown>).score;
  return typeof score === "number" && Number.isFinite(score) ? score : 0;
}

export function applyBalancedQualityPass(candidates: RawPublicAuditCandidate[]): RawPublicAuditCandidate[] {
  const bySource = new Map<string, RawPublicAuditCandidate[]>();
  for (const candidate of candidates) {
    const source = candidate.sourceType;
    const list = bySource.get(source);
    if (list) {
      list.push(candidate);
    } else {
      bySource.set(source, [candidate]);
    }
  }

  const out: RawPublicAuditCandidate[] = [];
  for (const [source, list] of bySource) {
    const high = list.filter((c) => c.confidenceBand === "high");
    const medium = list
      .filter((c) => c.confidenceBand === "medium")
      .sort((a, b) => {
        const scoreDelta = b.confidenceScore - a.confidenceScore;
        if (Math.abs(scoreDelta) > 0.0001) return scoreDelta;
        return identityScoreFromRawData(b.rawData) - identityScoreFromRawData(a.rawData);
      });
    const low = list.filter((c) => c.confidenceBand === "low");
    const cap = SOURCE_MEDIUM_CAPS[source] ?? 12;
    out.push(...high, ...medium.slice(0, cap), ...low.slice(0, 4));
  }
  return out;
}
