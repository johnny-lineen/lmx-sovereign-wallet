import type { PublicAuditConfidenceBand, VaultItemType } from "@prisma/client";

export type RawPublicAuditCandidate = {
  sourceType: string;
  sourceName: string;
  proposedVaultType: VaultItemType;
  title: string;
  url?: string | null;
  snippet?: string | null;
  matchedIdentifier?: string | null;
  confidenceBand: PublicAuditConfidenceBand;
  confidenceScore: number;
  auditKind: "profile" | "breach" | "broker" | "search" | "other";
  rawData?: unknown;
};

type HibpBreach = {
  Name?: string;
  Title?: string;
  BreachDate?: string;
  DataClasses?: string[];
};

const HIBP_ENDPOINT = "https://haveibeenpwned.com/api/v3/breachedaccount";

/**
 * Queries Have I Been Pwned v3 when `HIBP_API_KEY` is configured.
 * Returns no rows when disabled or unavailable.
 */
export async function fetchBreachCandidatesForEmail(normalizedEmail: string): Promise<RawPublicAuditCandidate[]> {
  const apiKey = process.env.HIBP_API_KEY?.trim();
  if (!apiKey) {
    return [];
  }

  const url = `${HIBP_ENDPOINT}/${encodeURIComponent(normalizedEmail)}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "hibp-api-key": apiKey,
        "user-agent": "LMX-Sovereign-Wallet/1.0",
      },
      cache: "no-store",
    });

    if (res.status === 404) {
      return [];
    }
    if (!res.ok) {
      return [
        {
          sourceType: "breach_adapter",
          sourceName: "Have I Been Pwned",
          proposedVaultType: "custom",
          title: `Exposure lookup unavailable (${res.status})`,
          snippet: "Breach API returned an error; no breach rows were imported.",
          matchedIdentifier: normalizedEmail,
          confidenceBand: "low",
          confidenceScore: 0.2,
          auditKind: "breach",
          rawData: { httpStatus: res.status },
        },
      ];
    }

    const data = (await res.json()) as HibpBreach[];
    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }

    const capped = data.slice(0, 25);
    return capped.map((b): RawPublicAuditCandidate => {
      const name = (b.Name ?? b.Title ?? "Unknown breach").trim() || "Unknown breach";
      return {
        sourceType: "breach_adapter",
        sourceName: "Have I Been Pwned",
        proposedVaultType: "custom",
        title: `Exposure event: ${name}`,
        snippet: b.BreachDate ? `Breach date: ${b.BreachDate}` : undefined,
        matchedIdentifier: normalizedEmail,
        confidenceBand: "high",
        confidenceScore: 0.92,
        auditKind: "breach",
        rawData: {
          breachName: name,
          breachDate: b.BreachDate ?? null,
          dataClasses: b.DataClasses ?? [],
        },
      };
    });
  } catch {
    return [];
  }
}
