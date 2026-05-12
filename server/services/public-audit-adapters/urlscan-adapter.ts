import type { RawPublicAuditCandidate } from "@/server/services/public-audit-adapters/breach-adapter";

type Input = {
  submittedEmail: string;
  websiteHint: string | null;
};

type UrlscanSearchResponse = {
  results?: Array<{
    page?: { domain?: string; url?: string; title?: string };
    task?: { time?: string };
  }>;
};

export async function fetchUrlscanCandidates(input: Input): Promise<RawPublicAuditCandidate[]> {
  if (process.env.PUBLIC_AUDIT_ENABLE_URLSCAN?.trim() === "0") return [];
  const domainFromEmail = input.submittedEmail.split("@")[1]?.trim().toLowerCase() ?? "";
  const hintedDomain = input.websiteHint?.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0] ?? "";
  const domain = hintedDomain || domainFromEmail;
  if (!domain) return [];

  const query = encodeURIComponent(`domain:${domain}`);
  const endpoint = `https://urlscan.io/api/v1/search/?q=${query}&size=10`;
  const headers: Record<string, string> = {};
  const apiKey = process.env.URLSCAN_API_KEY?.trim();
  if (apiKey) headers["API-Key"] = apiKey;

  const res = await fetch(endpoint, { headers, cache: "no-store" });
  if (!res.ok) return [];
  const body = (await res.json()) as UrlscanSearchResponse;
  const rows = Array.isArray(body.results) ? body.results : [];

  return rows.slice(0, 10).map((row): RawPublicAuditCandidate => {
    const page = row.page ?? {};
    const title = page.title?.trim() || page.domain?.trim() || domain;
    return {
      sourceType: "urlscan_adapter",
      sourceName: "urlscan.io",
      proposedVaultType: "custom",
      title: `Web footprint: ${title}`,
      url: page.url ?? null,
      snippet: row.task?.time ? `Observed in urlscan index at ${row.task.time}.` : "Observed in urlscan public index.",
      matchedIdentifier: domain,
      confidenceBand: "low",
      confidenceScore: 0.48,
      auditKind: "search",
      rawData: { provider: "urlscan", domain },
    };
  });
}
