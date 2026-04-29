import type { RawPublicAuditCandidate } from "@/server/services/public-audit-adapters/breach-adapter";

type FetchNameInferenceCandidatesInput = {
  fullName: string;
};

type PlatformTemplate = {
  platform: string;
  profileUrl: (slug: string) => string;
  confidenceScore: number;
};

const PLATFORMS: PlatformTemplate[] = [
  { platform: "LinkedIn", profileUrl: (s) => `https://www.linkedin.com/in/${s}/`, confidenceScore: 0.52 },
  { platform: "X", profileUrl: (s) => `https://x.com/${s}`, confidenceScore: 0.47 },
  { platform: "GitHub", profileUrl: (s) => `https://github.com/${s}`, confidenceScore: 0.45 },
];

function normalizeName(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 2);
}

function buildSlugGuesses(name: string): string[] {
  const parts = normalizeName(name);
  if (parts.length === 0) return [];
  const first = parts[0] ?? "";
  const last = parts[parts.length - 1] ?? "";
  const joined = parts.join("");
  const hyphen = parts.join("-");
  const underscore = parts.join("_");

  const guesses = [
    joined,
    hyphen,
    underscore,
    first && last ? `${first}${last}` : "",
    first && last ? `${first}-${last}` : "",
    first && last ? `${first}_${last}` : "",
    first && last ? `${last}${first}` : "",
    first && last ? `${last}-${first}` : "",
    first && last ? `${first}${last}1` : "",
  ]
    .map((s) => s.trim())
    .filter((s) => s.length >= 4 && s.length <= 40);

  return [...new Set(guesses)].slice(0, 8);
}

export async function fetchNameInferenceCandidates(
  input: FetchNameInferenceCandidatesInput,
): Promise<RawPublicAuditCandidate[]> {
  const slugs = buildSlugGuesses(input.fullName);
  if (slugs.length === 0) return [];

  const out: RawPublicAuditCandidate[] = [];
  for (const slug of slugs) {
    for (const p of PLATFORMS) {
      out.push({
        sourceType: "name_inference_adapter",
        sourceName: "Name inference",
        proposedVaultType: "social_account",
        title: `${p.platform} inferred profile: ${slug}`,
        url: p.profileUrl(slug),
        snippet: `Possible ${p.platform} profile inferred from submitted full name.`,
        matchedIdentifier: slug,
        confidenceBand: "low",
        confidenceScore: p.confidenceScore,
        auditKind: "profile",
        rawData: {
          provider: "name_inference",
          inferred: true,
          platform: p.platform,
        },
      });
    }
  }
  return out;
}
