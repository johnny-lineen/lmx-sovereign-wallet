import type { RawPublicAuditCandidate } from "@/server/services/public-audit-adapters/breach-adapter";

type Input = {
  fullName: string;
  usernames: string[];
};

const PROVIDERS = [
  { name: "GitHub", url: (u: string) => `https://github.com/${u}` },
  { name: "X", url: (u: string) => `https://x.com/${u}` },
  { name: "Reddit", url: (u: string) => `https://www.reddit.com/user/${u}` },
  { name: "Instagram", url: (u: string) => `https://www.instagram.com/${u}/` },
] as const;

export async function fetchUsernameCheckCandidates(input: Input): Promise<RawPublicAuditCandidate[]> {
  const handles = [...new Set(input.usernames.map((u) => u.trim().replace(/^@+/, "").toLowerCase()).filter(Boolean))].slice(0, 8);
  const rows: RawPublicAuditCandidate[] = [];
  for (const username of handles) {
    for (const provider of PROVIDERS) {
      rows.push({
        sourceType: "username_check_adapter",
        sourceName: "Username check",
        proposedVaultType: "social_account",
        title: `${provider.name} account check: @${username}`,
        url: provider.url(username),
        snippet: `Candidate account from username-check pipeline for ${input.fullName}.`,
        matchedIdentifier: username,
        confidenceBand: "medium",
        confidenceScore: 0.65,
        auditKind: "profile",
        rawData: { provider: "username_check", platform: provider.name },
      });
    }
  }
  return rows;
}
