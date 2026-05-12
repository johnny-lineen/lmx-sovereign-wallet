import type { RawPublicAuditCandidate } from "@/server/services/public-audit-adapters/breach-adapter";

type Input = {
  fullName: string;
  locationHint: string | null;
};

type OpenSanctionsSearchResponse = {
  results?: Array<{
    id?: string;
    caption?: string;
    schema?: string;
    score?: number;
    datasets?: string[];
  }>;
};

export async function fetchOpenSanctionsCandidates(input: Input): Promise<RawPublicAuditCandidate[]> {
  if (process.env.PUBLIC_AUDIT_ENABLE_OPENSANCTIONS?.trim() === "0") return [];
  const baseUrl = process.env.OPENSANCTIONS_API_BASE_URL?.trim();
  if (!baseUrl) return [];

  const query = input.locationHint?.trim()
    ? `${input.fullName.trim()} ${input.locationHint.trim()}`
    : input.fullName.trim();
  if (query.length < 3) return [];

  const endpoint = new URL("/search/entities", baseUrl);
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("limit", "8");
  const res = await fetch(endpoint.toString(), { cache: "no-store" });
  if (!res.ok) return [];
  const body = (await res.json()) as OpenSanctionsSearchResponse;
  const rows = Array.isArray(body.results) ? body.results : [];

  return rows
    .filter((row) => typeof row.score === "number" && row.score >= 0.4)
    .slice(0, 8)
    .map((row): RawPublicAuditCandidate => {
      const score = Math.min(0.72, Math.max(0.42, row.score ?? 0.42));
      return {
        sourceType: "open_sanctions_adapter",
        sourceName: "OpenSanctions",
        proposedVaultType: "custom",
        title: `Public records signal: ${row.caption ?? input.fullName}`,
        snippet: `Entity match (${row.schema ?? "entity"}) from open-source sanctions/public records data.`,
        matchedIdentifier: row.id ?? input.fullName,
        confidenceBand: score >= 0.6 ? "medium" : "low",
        confidenceScore: score,
        auditKind: "other",
        rawData: {
          provider: "open_sanctions",
          schema: row.schema ?? null,
          datasets: row.datasets ?? [],
          score: row.score ?? null,
        },
      };
    });
}
