/** Stable pipeline ids for grouping public audit candidates in API + UI. */
export const PUBLIC_AUDIT_PIPELINE_ORDER = [
  "accounts",
  "breaches",
  "emails",
  "domains",
  "signals",
  "other",
] as const;

export type PublicAuditPipelineId = (typeof PUBLIC_AUDIT_PIPELINE_ORDER)[number];

const ACCOUNT_SOURCE_TYPES = new Set([
  "public_profile_adapter",
  "username_surface_adapter",
  "username_check_adapter",
  "name_inference_adapter",
  "people_social_adapter",
]);
const EMAIL_SOURCE_TYPES = new Set(["gmail_inbox_adapter", "email_intel_adapter"]);
const DOMAIN_SOURCE_TYPES = new Set(["input_email_domain_adapter", "input_website_adapter"]);
const SIGNAL_SOURCE_TYPES = new Set(["public_search_adapter", "broker_presence_adapter", "input_location_search_adapter"]);

export function pipelineIdFromSourceType(sourceType: string): PublicAuditPipelineId {
  if (sourceType === "breach_adapter") return "breaches";
  if (ACCOUNT_SOURCE_TYPES.has(sourceType)) return "accounts";
  if (EMAIL_SOURCE_TYPES.has(sourceType)) return "emails";
  if (DOMAIN_SOURCE_TYPES.has(sourceType)) return "domains";
  if (SIGNAL_SOURCE_TYPES.has(sourceType) || sourceType.startsWith("input_")) return "signals";
  return "other";
}

export function pipelineLabel(id: PublicAuditPipelineId): string {
  switch (id) {
    case "accounts":
      return "Accounts";
    case "breaches":
      return "Breaches";
    case "emails":
      return "Emails";
    case "domains":
      return "Domains";
    case "signals":
      return "Signals";
    default:
      return "Other";
  }
}

export type PipelineSummaryEntry = {
  count: number;
  error?: boolean;
  skipped?: string;
};

export type PublicAuditPipelineSummary = {
  pipelines: Record<string, PipelineSummaryEntry>;
  completedAt: string;
  providerErrors?: string[];
};

type CandidateLike = { sourceType: string };

export function countCandidatesByPipeline(candidates: CandidateLike[]): Record<PublicAuditPipelineId, number> {
  const counts: Record<PublicAuditPipelineId, number> = {
    accounts: 0,
    breaches: 0,
    emails: 0,
    domains: 0,
    signals: 0,
    other: 0,
  };
  for (const c of candidates) {
    const id = pipelineIdFromSourceType(c.sourceType);
    counts[id] += 1;
  }
  return counts;
}

const PROVIDER_ERROR_TO_PIPELINE: Record<string, PublicAuditPipelineId> = {
  serpapi: "signals",
  hibp: "breaches",
  gmail: "emails",
  username_surface: "accounts",
  username_check: "accounts",
  people_social: "accounts",
  email_intel: "emails",
  name_inference: "accounts",
};

export function buildPipelineSummaryPayload(params: {
  candidates: CandidateLike[];
  providerErrors: string[];
  hibpSkippedReason?: "no_api_key";
}): PublicAuditPipelineSummary {
  const counts = countCandidatesByPipeline(params.candidates);
  const pipelines: Record<string, PipelineSummaryEntry> = {};

  for (const id of PUBLIC_AUDIT_PIPELINE_ORDER) {
    const count = counts[id];
    if (count > 0) {
      pipelines[id] = { count };
    }
  }

  if (params.hibpSkippedReason === "no_api_key") {
    pipelines.breaches = {
      count: counts.breaches,
      skipped: "no_api_key",
      ...(pipelines.breaches?.error ? { error: true } : {}),
    };
  }

  for (const err of params.providerErrors) {
    const pid = PROVIDER_ERROR_TO_PIPELINE[err];
    if (!pid) continue;
    const prev = pipelines[pid];
    pipelines[pid] = {
      count: prev?.count ?? counts[pid],
      ...(prev?.skipped !== undefined ? { skipped: prev.skipped } : {}),
      error: true,
    };
  }

  return {
    pipelines,
    completedAt: new Date().toISOString(),
    ...(params.providerErrors.length > 0 ? { providerErrors: params.providerErrors } : {}),
  };
}

export type GroupedPipeline<T> = { id: PublicAuditPipelineId; label: string; candidates: T[] };

export function groupCandidatesByPipeline<T extends CandidateLike>(candidates: T[]): GroupedPipeline<T>[] {
  const byId = new Map<PublicAuditPipelineId, T[]>();
  for (const id of PUBLIC_AUDIT_PIPELINE_ORDER) {
    byId.set(id, []);
  }
  for (const c of candidates) {
    const id = pipelineIdFromSourceType(c.sourceType);
    byId.get(id)!.push(c);
  }
  const out: GroupedPipeline<T>[] = [];
  for (const id of PUBLIC_AUDIT_PIPELINE_ORDER) {
    const list = byId.get(id)!;
    if (list.length === 0) continue;
    out.push({ id, label: pipelineLabel(id), candidates: list });
  }
  return out;
}
