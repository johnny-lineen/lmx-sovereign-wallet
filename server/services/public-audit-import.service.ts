import type { Prisma, PublicAuditConfidenceBand, VaultItemType, VaultRelationType } from "@prisma/client";

import * as vaultRepo from "@/server/repositories/vault.repository";
import { buildPublicAuditDedupeKey } from "@/server/services/public-audit-resolution.service";

type CandidateImportShape = {
  id: string;
  proposedVaultType: VaultItemType;
  title: string;
  sourceType: string;
  sourceName: string;
  url: string | null;
  snippet: string | null;
  matchedIdentifier: string | null;
  confidenceScore: number;
  confidenceBand: PublicAuditConfidenceBand;
  rawData: unknown;
};

function readAuditKind(raw: unknown): "profile" | "breach" | "broker" | "search" | "other" {
  if (!raw || typeof raw !== "object") return "other";
  const k = (raw as Record<string, unknown>).auditKind;
  if (k === "profile" || k === "breach" || k === "broker" || k === "search" || k === "other") {
    return k;
  }
  return "other";
}

function customSubtypeForAuditKind(kind: ReturnType<typeof readAuditKind>): string {
  if (kind === "breach") return "breach_event";
  if (kind === "broker") return "data_broker_listing";
  return "public_finding";
}

function relationPlan(
  vaultType: VaultItemType,
  auditKind: ReturnType<typeof readAuditKind>,
): { relationType: VaultRelationType } {
  if (vaultType === "custom" && auditKind === "breach") {
    return { relationType: "linked_to" };
  }
  return { relationType: "uses_email" };
}

async function ensureEdge(
  tx: Prisma.TransactionClient,
  userId: string,
  fromItemId: string,
  toItemId: string,
  relationType: VaultRelationType,
  metadata: Prisma.InputJsonValue,
) {
  const existing = await vaultRepo.findVaultRelationshipForUser(
    userId,
    fromItemId,
    toItemId,
    relationType,
    tx,
  );
  if (existing) return;
  await tx.vaultRelationship.create({
    data: {
      userId,
      fromItemId,
      toItemId,
      relationType,
      metadata,
    },
  });
}

/**
 * Creates or links a vault item for one audit candidate and connects it to the profile email anchor.
 */
export async function importPublicAuditCandidate(
  tx: Prisma.TransactionClient,
  userId: string,
  candidate: CandidateImportShape,
  emailVaultItemId: string,
  auditRunId: string,
): Promise<{ status: "auto_imported" | "linked_existing"; vaultItemId: string }> {
  const auditKind = readAuditKind(candidate.rawData);
  const dedupeKey = buildPublicAuditDedupeKey({
    sourceType: candidate.sourceType,
    proposedVaultType: candidate.proposedVaultType,
    url: candidate.url,
    title: candidate.title,
    matchedIdentifier: candidate.matchedIdentifier,
  });

  const existingId = await vaultRepo.findVaultItemByPublicAuditDedupe(userId, dedupeKey, tx);
  if (existingId) {
    const plan = relationPlan(candidate.proposedVaultType, auditKind);
    const meta = {
      source: "public_audit",
      importedFromAuditRunId: auditRunId,
      publicAuditCandidateId: candidate.id,
    } as Prisma.InputJsonValue;
    if (plan.relationType === "uses_email") {
      await ensureEdge(tx, userId, existingId.id, emailVaultItemId, "uses_email", meta);
    } else {
      await ensureEdge(tx, userId, existingId.id, emailVaultItemId, "linked_to", meta);
    }
    return { status: "linked_existing", vaultItemId: existingId.id };
  }

  const summaryParts = [`Public footprint audit (${candidate.sourceType})`];
  if (candidate.snippet?.trim()) {
    summaryParts.push(candidate.snippet.trim().slice(0, 400));
  }

  const metadata: Record<string, unknown> = {
    source: "public_audit",
    sourceName: candidate.sourceName,
    confidence: candidate.confidenceScore,
    importedFromAuditRunId: auditRunId,
    public_audit_dedupe: dedupeKey,
    publicAuditCandidateId: candidate.id,
    verified: false,
    auditKind,
  };
  if (candidate.url?.trim()) metadata.url = candidate.url.trim();
  if (candidate.matchedIdentifier?.trim()) metadata.matchedIdentifier = candidate.matchedIdentifier.trim();
  if (candidate.proposedVaultType === "custom") {
    metadata.auditSubtype = customSubtypeForAuditKind(auditKind);
  }

  const item = await tx.vaultItem.create({
    data: {
      userId,
      type: candidate.proposedVaultType,
      title: candidate.title,
      summary: summaryParts.join(" — "),
      provider: candidate.sourceName,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });

  const plan = relationPlan(candidate.proposedVaultType, auditKind);
  const edgeMeta = {
    source: "public_audit",
    importedFromAuditRunId: auditRunId,
    publicAuditCandidateId: candidate.id,
  } as Prisma.InputJsonValue;

  if (plan.relationType === "uses_email") {
    await ensureEdge(tx, userId, item.id, emailVaultItemId, "uses_email", edgeMeta);
  } else {
    await ensureEdge(tx, userId, item.id, emailVaultItemId, "linked_to", edgeMeta);
  }

  return { status: "auto_imported", vaultItemId: item.id };
}
