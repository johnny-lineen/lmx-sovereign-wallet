import type { RawPublicAuditCandidate } from "@/server/services/public-audit-adapters/breach-adapter";
import { readString, runCliJson } from "@/server/services/public-audit-adapters/osint-cli-utils";

type Input = {
  fullName: string;
  submittedEmail: string;
  usernames: string[];
};

function pickHandle(input: Input): string | null {
  const handle = input.usernames.map((v) => v.trim().replace(/^@+/, "")).find((v) => v.length > 1);
  return handle ?? null;
}

export async function fetchUserScannerCandidates(input: Input): Promise<RawPublicAuditCandidate[]> {
  if (process.env.PUBLIC_AUDIT_ENABLE_USER_SCANNER?.trim() === "0") return [];
  const handle = pickHandle(input);
  if (!handle) return [];

  const output = await runCliJson("user-scanner", ["--username", handle, "--json"], 10_000);
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
    const service = readString(obj.service) ?? readString(obj.site) ?? "Unknown service";
    const url = readString(obj.url) ?? readString(obj.profile_url);
    const matched = Boolean(obj.found ?? obj.exists ?? true);
    if (!matched) continue;
    candidates.push({
      sourceType: "user_scanner_adapter",
      sourceName: "User-Scanner",
      proposedVaultType: "subscription",
      title: `Service footprint: ${service}`,
      url,
      snippet: `Potential account/subscription found for @${handle} (${input.fullName}).`,
      matchedIdentifier: handle,
      confidenceBand: "medium",
      confidenceScore: 0.64,
      auditKind: "other",
      rawData: { provider: "user_scanner", service, handle, submittedEmail: input.submittedEmail },
    });
  }

  return candidates.slice(0, 35);
}
