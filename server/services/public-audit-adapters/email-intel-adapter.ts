import type { RawPublicAuditCandidate } from "@/server/services/public-audit-adapters/breach-adapter";

type Input = {
  submittedEmail: string;
  websiteHint: string | null;
};

const DISPOSABLE_DOMAINS = new Set(["mailinator.com", "guerrillamail.com", "10minutemail.com"]);

export async function fetchEmailIntelCandidates(input: Input): Promise<RawPublicAuditCandidate[]> {
  const email = input.submittedEmail.trim().toLowerCase();
  const domain = email.split("@")[1]?.trim().toLowerCase();
  if (!domain) return [];

  const disposable = DISPOSABLE_DOMAINS.has(domain);
  const website = input.websiteHint?.trim().toLowerCase() ?? "";
  const domainMatchesWebsite = website.includes(domain);

  return [
    {
      sourceType: "email_intel_adapter",
      sourceName: "Email intelligence",
      proposedVaultType: "custom",
      title: `Email risk profile: ${email}`,
      snippet: disposable
        ? "Disposable email domain pattern detected."
        : "Email format and domain pattern look stable for account linkage.",
      matchedIdentifier: email,
      confidenceBand: disposable ? "low" : "medium",
      confidenceScore: disposable ? 0.34 : 0.63,
      auditKind: "other",
      rawData: { provider: "email_intel", disposable, domain },
    },
    {
      sourceType: "email_intel_adapter",
      sourceName: "Email intelligence",
      proposedVaultType: "custom",
      title: `Email domain signal: ${domain}`,
      snippet: domainMatchesWebsite
        ? "Submitted website appears aligned with submitted email domain."
        : "Email domain captured for downstream domain-intel enrichment.",
      matchedIdentifier: domain,
      confidenceBand: "low",
      confidenceScore: domainMatchesWebsite ? 0.52 : 0.41,
      auditKind: "search",
      rawData: { provider: "email_intel", domainMatchesWebsite },
    },
  ];
}
