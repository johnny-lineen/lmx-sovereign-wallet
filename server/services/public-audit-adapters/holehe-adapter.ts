import type { RawPublicAuditCandidate } from "@/server/services/public-audit-adapters/breach-adapter";
import { readString, runCliJson } from "@/server/services/public-audit-adapters/osint-cli-utils";

type Input = {
  submittedEmail: string;
};

export async function fetchHoleheCandidates(input: Input): Promise<RawPublicAuditCandidate[]> {
  const email = input.submittedEmail.trim().toLowerCase();
  if (!email.includes("@")) return [];
  if (process.env.PUBLIC_AUDIT_ENABLE_HOLEHE?.trim() === "0") return [];

  const output = await runCliJson("holehe", [email, "--only-used", "--json"], 12_000);
  if (!output || output.stdout.trim().length === 0) return [];
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
    const service = readString(obj.name) ?? readString(obj.site) ?? "Service";
    const used = Boolean(obj.used);
    if (!used) continue;
    const domain = readString(obj.domain);
    candidates.push({
      sourceType: "holehe_adapter",
      sourceName: "Holehe",
      proposedVaultType: "subscription",
      title: `Subscription signal: ${service}`,
      snippet: domain
        ? `Email appears registered on ${service} (${domain}).`
        : `Email appears registered on ${service}.`,
      matchedIdentifier: email,
      confidenceBand: "medium",
      confidenceScore: 0.66,
      auditKind: "other",
      rawData: { provider: "holehe", service, domain },
    });
  }
  return candidates.slice(0, 25);
}
