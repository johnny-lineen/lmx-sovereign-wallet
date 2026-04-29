/**
 * Stable dedupe keys for public-audit imports (stored on vault items and used for lookups).
 */
export function buildPublicAuditDedupeKey(input: {
  sourceType: string;
  proposedVaultType: string;
  url?: string | null;
  title: string;
  matchedIdentifier?: string | null;
}): string {
  const st = input.sourceType.trim().toLowerCase().slice(0, 64);
  const pt = input.proposedVaultType.trim().toLowerCase();
  const u = input.url?.trim().toLowerCase();
  if (u && u.length > 3) {
    return `${st}:url:${u}`.slice(0, 512);
  }
  const id = (input.matchedIdentifier ?? input.title).trim().toLowerCase().slice(0, 240);
  return `${st}:${pt}:${id}`.slice(0, 512);
}
