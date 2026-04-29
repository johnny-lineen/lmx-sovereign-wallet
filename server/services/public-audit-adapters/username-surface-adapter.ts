import type { RawPublicAuditCandidate } from "@/server/services/public-audit-adapters/breach-adapter";

type FetchUsernameSurfaceCandidatesInput = {
  fullName: string;
  usernames: string[];
};

type UsernameSurfaceTemplate = {
  platform: string;
  profileUrl: (username: string) => string;
  confidenceScore: number;
};

const USERNAME_TEMPLATES: UsernameSurfaceTemplate[] = [
  { platform: "GitHub", profileUrl: (u) => `https://github.com/${u}`, confidenceScore: 0.74 },
  { platform: "X", profileUrl: (u) => `https://x.com/${u}`, confidenceScore: 0.7 },
  { platform: "Reddit", profileUrl: (u) => `https://www.reddit.com/user/${u}`, confidenceScore: 0.68 },
  { platform: "Instagram", profileUrl: (u) => `https://www.instagram.com/${u}/`, confidenceScore: 0.66 },
  { platform: "TikTok", profileUrl: (u) => `https://www.tiktok.com/@${u}`, confidenceScore: 0.64 },
  { platform: "LinkedIn", profileUrl: (u) => `https://www.linkedin.com/in/${u}/`, confidenceScore: 0.62 },
  { platform: "YouTube", profileUrl: (u) => `https://www.youtube.com/@${u}`, confidenceScore: 0.61 },
  { platform: "Medium", profileUrl: (u) => `https://medium.com/@${u}`, confidenceScore: 0.58 },
];

function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

function candidateForPlatform(
  fullName: string,
  username: string,
  template: UsernameSurfaceTemplate,
): RawPublicAuditCandidate {
  return {
    sourceType: "username_surface_adapter",
    sourceName: "Username surface",
    proposedVaultType: "social_account",
    title: `${template.platform} profile candidate: @${username}`,
    url: template.profileUrl(username),
    snippet: `Possible ${template.platform} public profile for ${fullName}.`,
    matchedIdentifier: username,
    confidenceBand: "medium",
    confidenceScore: template.confidenceScore,
    auditKind: "profile",
    rawData: {
      provider: "username_surface",
      platform: template.platform,
      generated: true,
    },
  };
}

export async function fetchUsernameSurfaceCandidates(
  input: FetchUsernameSurfaceCandidatesInput,
): Promise<RawPublicAuditCandidate[]> {
  const normalizedHandles = [...new Set(input.usernames.map(normalizeUsername).filter((u) => u.length >= 2))].slice(
    0,
    8,
  );
  if (normalizedHandles.length === 0) return [];

  const rows: RawPublicAuditCandidate[] = [];
  for (const username of normalizedHandles) {
    for (const template of USERNAME_TEMPLATES) {
      rows.push(candidateForPlatform(input.fullName, username, template));
    }
  }

  return rows;
}
