import type { RawPublicAuditCandidate } from "@/server/services/public-audit-adapters/breach-adapter";
import { readString, runCliJson } from "@/server/services/public-audit-adapters/osint-cli-utils";

type Input = {
  fullName: string;
  usernames: string[];
};

export async function fetchMaigretCandidates(input: Input): Promise<RawPublicAuditCandidate[]> {
  const handle = input.usernames.map((v) => v.trim().replace(/^@+/, "")).find((v) => v.length > 1);
  if (!handle) return [];
  if (process.env.PUBLIC_AUDIT_ENABLE_MAIGRET?.trim() === "0") return [];

  const output = await runCliJson("maigret", [handle, "--json"], 10_000);
  if (!output || output.exitCode !== 0 || output.stdout.trim().length === 0) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(output.stdout);
  } catch {
    return [];
  }
  const rows = Array.isArray(parsed) ? parsed : [];
  const candidates: RawPublicAuditCandidate[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const obj = row as Record<string, unknown>;
    const site = readString(obj.site_name) ?? readString(obj.site) ?? "Unknown";
    const profile = readString(obj.url_user) ?? readString(obj.url);
    if (!profile) continue;
    candidates.push({
      sourceType: "maigret_adapter",
      sourceName: "Maigret",
      proposedVaultType: "social_account",
      title: `${site} account: @${handle}`,
      url: profile,
      snippet: `Account presence discovered by Maigret for ${input.fullName}.`,
      matchedIdentifier: handle,
      confidenceBand: "medium",
      confidenceScore: 0.68,
      auditKind: "profile",
      rawData: { provider: "maigret", site, handle },
    });
  }
  return candidates.slice(0, 30);
}
