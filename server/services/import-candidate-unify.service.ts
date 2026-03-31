import { importCandidateMergeGroupKey } from "@/lib/entity-unify";
import type { ImportCandidateWithJobContextRow } from "@/server/repositories/gmail-import.repository";
import * as gmailImportRepo from "@/server/repositories/gmail-import.repository";
import type { ImportCandidateStatus } from "@prisma/client";

export type UnifiedImportCandidateMember = {
  id: string;
  importJobId: string;
  status: string;
  signal: string;
  suggestedType: string;
  title: string;
  provider: string | null;
  providerDomain: string | null;
  evidence: unknown;
  dedupeKey: string;
  createdVaultItemId: string | null;
  createdAt: string;
  /** Profile anchor email or connector Gmail for this scan row. */
  sourceEmail: string | null;
};

export type UnifiedImportCandidateGroup = {
  /** Same logical key used for vault graph merging (`entity:…` or `singleton:…`). */
  unificationKey: string;
  suggestedType: string;
  title: string;
  provider: string | null;
  /** Distinct inbox / profile emails under which this service appeared. */
  sourceEmails: string[];
  members: UnifiedImportCandidateMember[];
};

function resolveSourceEmail(row: ImportCandidateWithJobContextRow): string | null {
  const profile = row.importJob.profileEmailItem?.title?.trim();
  if (profile) return profile.toLowerCase();
  const gmail = row.importJob.gmailConnector.gmailAddress.trim();
  return gmail ? gmail.toLowerCase() : null;
}

function toMemberDTO(row: ImportCandidateWithJobContextRow): UnifiedImportCandidateMember {
  return {
    id: row.id,
    importJobId: row.importJobId,
    status: row.status,
    signal: row.signal,
    suggestedType: row.suggestedType,
    title: row.title,
    provider: row.provider,
    providerDomain: row.providerDomain,
    evidence: row.evidence,
    dedupeKey: row.dedupeKey,
    createdVaultItemId: row.createdVaultItemId,
    createdAt: row.createdAt.toISOString(),
    sourceEmail: resolveSourceEmail(row),
  };
}

/**
 * Groups import scan rows so the same account/service (e.g. Uber) appears once with multiple
 * members when it was detected under different profiles or scans.
 */
export function unifyImportCandidatesWithJobContext(
  rows: ImportCandidateWithJobContextRow[],
): UnifiedImportCandidateGroup[] {
  const byKey = new Map<string, ImportCandidateWithJobContextRow[]>();
  for (const row of rows) {
    const k = importCandidateMergeGroupKey(row);
    const list = byKey.get(k);
    if (list) list.push(row);
    else byKey.set(k, [row]);
  }

  const groups: UnifiedImportCandidateGroup[] = [];

  for (const [unificationKey, members] of byKey) {
    const sorted = members.slice().sort((a, b) => a.id.localeCompare(b.id));
    const canonical = sorted[0]!;
    const sourceEmails = [
      ...new Set(
        sorted.map((m) => resolveSourceEmail(m)).filter((e): e is string => typeof e === "string" && e.length > 0),
      ),
    ].sort();

    groups.push({
      unificationKey,
      suggestedType: canonical.suggestedType,
      title: canonical.title,
      provider: canonical.provider,
      sourceEmails,
      members: sorted.map(toMemberDTO),
    });
  }

  return groups.sort((a, b) => a.title.localeCompare(b.title));
}

export async function getUnifiedImportCandidatesForUserId(
  userId: string,
  filters: { importJobId?: string; status?: ImportCandidateStatus },
): Promise<UnifiedImportCandidateGroup[]> {
  const rows = await gmailImportRepo.listImportCandidatesWithJobContextForUser(userId, filters);
  return unifyImportCandidatesWithJobContext(rows);
}
