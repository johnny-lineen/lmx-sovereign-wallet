/**
 * Shared rules for collapsing duplicate “same service” rows (vault items or import candidates)
 * so one logical account (e.g. Uber) maps to a single node or group.
 */

export function normalizeEntityTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Vault item / candidate types that merge by normalized title (aligned with graph rendering). */
export const MERGEABLE_ENTITY_TYPES = new Set(["account", "social_account", "subscription"]);

export function vaultItemMergeGroupKey(item: { id: string; type: string; title: string; metadata?: unknown }): string {
  if (item.type === "email") {
    return `email:${item.id}`;
  }
  if (!MERGEABLE_ENTITY_TYPES.has(item.type)) {
    return `singleton:${item.id}`;
  }
  const meta =
    item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
      ? (item.metadata as Record<string, unknown>)
      : null;
  const domainRaw = meta?.canonicalProviderDomain;
  const domain = typeof domainRaw === "string" ? domainRaw.trim().toLowerCase() : "";
  if (domain.length > 0) {
    return `entity:${item.type}:${domain}`;
  }
  return `entity:${item.type}:${normalizeEntityTitle(item.title)}`;
}

export function importCandidateMergeGroupKey(row: {
  id: string;
  suggestedType: string;
  title: string;
  providerDomain?: string | null;
}): string {
  if (!MERGEABLE_ENTITY_TYPES.has(row.suggestedType)) {
    return `singleton:${row.id}`;
  }
  const d = row.providerDomain?.trim().toLowerCase() ?? "";
  if (d.length > 0) {
    return `entity:${row.suggestedType}:${d}`;
  }
  return `entity:${row.suggestedType}:${normalizeEntityTitle(row.title)}`;
}
