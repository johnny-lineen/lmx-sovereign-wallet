import type { RawPublicAuditCandidate } from "@/server/services/public-audit-adapters/breach-adapter";

type Input = {
  fullName: string;
  usernames: string[];
  submittedEmail: string;
  websiteHint: string | null;
};

export async function fetchPeopleSocialCandidates(input: Input): Promise<RawPublicAuditCandidate[]> {
  const rows: RawPublicAuditCandidate[] = [];
  const fullName = input.fullName.trim();
  if (fullName.length >= 3) {
    rows.push({
      sourceType: "people_social_adapter",
      sourceName: "People/social enrichment",
      proposedVaultType: "identity_profile",
      title: `Public profile enrichment: ${fullName}`,
      snippet: "Cross-source identity summary candidate built from search anchors.",
      matchedIdentifier: fullName,
      confidenceBand: "medium",
      confidenceScore: 0.6,
      auditKind: "profile",
      rawData: { provider: "people_social", submittedEmail: input.submittedEmail },
    });
  }
  if (input.websiteHint?.trim()) {
    const website = input.websiteHint.trim();
    rows.push({
      sourceType: "people_social_adapter",
      sourceName: "People/social enrichment",
      proposedVaultType: "custom",
      title: `People/social domain signal: ${website}`,
      snippet: "Domain signal inferred from website context.",
      matchedIdentifier: website,
      confidenceBand: "low",
      confidenceScore: 0.46,
      auditKind: "search",
      rawData: { provider: "people_social", inferredFrom: "website_hint" },
    });
  }
  if (input.usernames.length > 0) {
    const first = input.usernames[0]!;
    rows.push({
      sourceType: "people_social_adapter",
      sourceName: "People/social enrichment",
      proposedVaultType: "social_account",
      title: `Alias enrichment candidate: @${first}`,
      snippet: "Alias candidate generated for cross-platform correlation.",
      matchedIdentifier: first,
      confidenceBand: "medium",
      confidenceScore: 0.57,
      auditKind: "profile",
      rawData: { provider: "people_social", inferredFrom: "username" },
    });
  }
  return rows;
}
